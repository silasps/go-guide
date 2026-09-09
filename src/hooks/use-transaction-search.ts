'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TransactionWithCategory } from '@/types/database'
import { filterTransactions } from '@/lib/financial/transaction-search'
import { localRelatedTerms } from '@/lib/financial/search-synonyms'

// Cache em memória do módulo — sobrevive a re-render/remontagem do
// componente na mesma sessão de página (troca de aba, reabrir o painel),
// evita repetir a mesma chamada de IA pro mesmo termo buscado de novo.
const expansionCache = new Map<string, string[]>()

const DEBOUNCE_MS = 450
const MIN_QUERY_LENGTH = 2
const MAX_CANDIDATES = 200

/**
 * Filtro instantâneo (nome/categoria/parceiro/data/valor, ver
 * `filterTransactions`) sempre ativo, sem espera. Depois de uma pausa de
 * digitação, SEMPRE tenta ampliar com sinônimos/marcas via IA (ver
 * `expandSearchTerms`) — não só quando o filtro direto acha zero
 * resultados. Essa condição existiu numa versão anterior e se revelou
 * frágil na prática: bastava UM lançamento qualquer bater por acaso com
 * algum token da busca (ex. uma categoria cujo nome contém parte da
 * palavra) pra pular a ampliação inteira, mesmo que ela devesse
 * complementar com mais resultados relevantes — igual buscador de
 * verdade (Google já fazia isso antes de IA existir): mistura o que bate
 * direto com o que é relacionado, não escolhe um ou outro. Custo
 * controlado pelo debounce (só dispara depois de parar de digitar) + cache
 * por termo (nunca repete a mesma chamada). Não gasta crédito de IA do
 * usuário. Falha na chamada (rede, erro, chave ausente) só deixa a busca
 * sem a ampliação — nunca quebra o filtro direto.
 *
 * A ampliação é "ancorada" nas categorias/descrições REAIS que já existem
 * nos lançamentos dessa pessoa (`candidates`, calculado abaixo) — pesquisa
 * de recuperação de informação mostra que pedir sinônimo pra uma IA "no
 * vácuo" (sem checar contra o corpus real) tende a divergir exatamente do
 * termo que já existe nos dados (ex.: pedir relacionado de "filme" sem
 * saber que a categoria "Streaming" já existe faz o modelo sugerir só
 * "cinema"/"ingresso", nunca "Streaming"/"Netflix", mesmo que o
 * lançamento certo esteja bem ali) — daí mandar a lista real primeiro,
 * priorizada sobre a criatividade genérica de marca conhecida.
 */
export function useTransactionSearch(transactions: TransactionWithCategory[], query: string) {
  // Guarda a query a que os termos pertencem, em vez de resetar o estado
  // sincronamente a cada troca de query dentro do efeito (o lint de hooks
  // reprova setState direto no corpo do efeito) — termos de uma query
  // antiga são simplesmente ignorados na leitura abaixo (`expansion.query
  // === query`), sem precisar de um "reset" explícito.
  const [expansion, setExpansion] = useState<{ query: string; terms: string[] } | null>(null)
  const [expandingQuery, setExpandingQuery] = useState<string | null>(null)
  const [failedQuery, setFailedQuery] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const baseFiltered = useMemo(() => filterTransactions(transactions, query), [transactions, query])

  // Categorias/subcategorias/descrições REAIS que já existem nos
  // lançamentos dessa pessoa — mandadas pra IA como base pra "ancorar" a
  // ampliação em vez de deixá-la adivinhar do zero (ver comentário de
  // `expandSearchTerms`). Deduplicado (a mesma descrição se repete todo
  // mês) e limitado pra não estourar tokens numa conta com muito histórico.
  const candidates = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions) {
      if (t.category?.name) set.add(t.category.name)
      if (t.subcategory?.name) set.add(t.subcategory.name)
    }
    for (const t of transactions) {
      if (set.size >= MAX_CANDIDATES) break
      if (t.description) set.add(t.description)
    }
    return Array.from(set).slice(0, MAX_CANDIDATES)
  }, [transactions])

  useEffect(() => {
    const trimmed = query.trim()
    const thisRequest = ++requestIdRef.current

    if (trimmed.length < MIN_QUERY_LENGTH) return

    const cacheKey = trimmed.toLowerCase()
    const cached = expansionCache.get(cacheKey)
    if (cached) {
      Promise.resolve().then(() => {
        if (requestIdRef.current === thisRequest) {
          setExpansion({ query, terms: cached })
          setFailedQuery(null)
        }
      })
      return
    }

    const timer = setTimeout(() => {
      setExpandingQuery(query)
      fetch('/api/ai/expand-search-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, candidates }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`expand-search-terms respondeu ${res.status}`)
          return res.json() as Promise<{ terms?: string[] }>
        })
        .then((data) => {
          const terms = Array.isArray(data.terms) ? data.terms : []
          expansionCache.set(cacheKey, terms)
          if (requestIdRef.current === thisRequest) {
            setExpansion({ query, terms })
            setFailedQuery(null)
          }
        })
        .catch((error) => {
          // fail-open: busca continua com o filtro direto (+ dicionário
          // local, ver `localFallbackTerms`), só sem a ampliação via IA —
          // registra em `console.warn` (não `console.error`) porque essa
          // falha já é tratada e não deve virar um "Console Error" no
          // overlay de dev do Next/Turbopack, que trata qualquer
          // `console.error` como problema visível mesmo quando a exceção
          // já foi capturada e a busca continua funcionando normalmente.
          // O estado visível pro usuário é `failedQuery`/`expansionFailed`
          // na própria UI, não esse log.
          console.warn('Busca inteligente: falha ao ampliar com IA (fail-open, sem impacto na busca)', error)
          if (requestIdRef.current === thisRequest) setFailedQuery(query)
        })
        .finally(() => {
          if (requestIdRef.current === thisRequest) setExpandingQuery(null)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, candidates])

  const expanding = expandingQuery === query
  const aiFailed = failedQuery === query && query.trim().length >= MIN_QUERY_LENGTH
  const aiAnswered = expansion?.query === query

  // Instantâneo, sem esperar debounce nem resposta de rede nenhuma — o
  // dicionário local é síncrono, então não faz sentido só usá-lo depois
  // que a IA falhar (é isso que uma versão anterior fazia, e o resultado
  // parecia "lento": a pessoa via nada até a IA desistir). Recalcula a
  // cada letra digitada, exatamente como o filtro direto — o usuário
  // pediu que "toda letra" já pesquise algo relacionado, não só quando a
  // palavra termina ou quando a IA (que leva um instante) responde.
  const localFallbackTerms = useMemo(() => localRelatedTerms(query), [query])

  const aiExtraTerms = useMemo(
    () => (expansion?.query === query ? expansion.terms : []),
    [expansion, query]
  )

  // Prioridade: a resposta da IA, quando ela já respondeu pra essa query
  // EXATA (mesmo que tenha sido "nada relacionado" — julgamento baseado
  // nos dados reais da pessoa vale mais que o dicionário genérico). Antes
  // disso responder (debounce ainda rolando, ou request em voo) ou se
  // falhar, usa o dicionário local — que já estava certo desde a
  // primeira letra, sem esperar nada.
  const activeExtraTerms = aiAnswered ? aiExtraTerms : localFallbackTerms

  const filtered = useMemo(
    () => (activeExtraTerms.length > 0 ? filterTransactions(transactions, query, activeExtraTerms) : baseFiltered),
    [transactions, query, activeExtraTerms, baseFiltered]
  )

  // Só marca como "ampliado" quando de fato trouxe lançamento extra além
  // do que o filtro direto já tinha achado — não só quando existem termos
  // (podem não ter batido em nada novo). `aiAssisted` e `localAssisted`
  // são mutuamente exclusivos (dependem de qual das duas fontes está
  // ativa agora — pode trocar de uma pra outra enquanto a IA ainda não
  // respondeu e depois responde).
  const aiAssisted = aiAnswered && filtered.length > baseFiltered.length
  const localAssisted = !aiAnswered && localFallbackTerms.length > 0 && filtered.length > baseFiltered.length

  return {
    filtered,
    expanding,
    aiAssisted,
    // A IA falhou de verdade E o dicionário local também não ajudou — só
    // nesse caso vale mostrar "não conseguimos ampliar" (se o dicionário
    // local salvou a busca, isso é bom o bastante pra não soar como erro).
    expansionFailed: aiFailed && !localAssisted,
    localAssisted,
    // A IA completou pra essa query exata (sucesso, não falhou), só que sem
    // acrescentar nada além do filtro direto — quarto estado, distinto de
    // "nunca tentou", "falhou" e "resolvido pelo dicionário local".
    expansionEmpty: aiAnswered && !aiAssisted,
    // Termos de fato usados pra ampliar (de qualquer uma das duas fontes)
    // — exposto pra diagnóstico visível na tela sem precisar abrir o
    // DevTools.
    expansionTerms: activeExtraTerms,
  }
}
