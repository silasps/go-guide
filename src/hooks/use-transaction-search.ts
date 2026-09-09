'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TransactionWithCategory } from '@/types/database'
import { filterTransactions } from '@/lib/financial/transaction-search'

// Cache em memória do módulo — sobrevive a re-render/remontagem do
// componente na mesma sessão de página (troca de aba, reabrir o painel),
// evita repetir a mesma chamada de IA pro mesmo termo buscado de novo.
const expansionCache = new Map<string, string[]>()

const DEBOUNCE_MS = 450
const MIN_QUERY_LENGTH = 2

/**
 * Filtro instantâneo (nome/categoria/parceiro/data/valor, ver
 * `filterTransactions`) sempre ativo, sem espera. Só quando ele não acha
 * NADA é que — depois de uma pausa de digitação — uma chamada a
 * `/api/ai/expand-search-terms` amplia a busca com sinônimos (ver
 * `expandSearchTerms`), sem bloquear a digitação nem gastar crédito de IA
 * do usuário. Falha na chamada (rede, erro) só deixa a busca sem a
 * ampliação — nunca quebra o filtro direto.
 */
export function useTransactionSearch(transactions: TransactionWithCategory[], query: string) {
  // Guarda a query a que os termos pertencem, em vez de resetar o estado
  // sincronamente a cada troca de query dentro do efeito (o lint de hooks
  // reprova setState direto no corpo do efeito) — termos de uma query
  // antiga são simplesmente ignorados na leitura abaixo (`expansion.query
  // === query`), sem precisar de um "reset" explícito.
  const [expansion, setExpansion] = useState<{ query: string; terms: string[] } | null>(null)
  const [expandingQuery, setExpandingQuery] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const baseFiltered = useMemo(() => filterTransactions(transactions, query), [transactions, query])

  useEffect(() => {
    const trimmed = query.trim()
    const thisRequest = ++requestIdRef.current

    if (trimmed.length < MIN_QUERY_LENGTH || baseFiltered.length > 0) return

    const cacheKey = trimmed.toLowerCase()
    const cached = expansionCache.get(cacheKey)
    if (cached) {
      Promise.resolve().then(() => {
        if (requestIdRef.current === thisRequest) setExpansion({ query, terms: cached })
      })
      return
    }

    const timer = setTimeout(() => {
      setExpandingQuery(query)
      fetch('/api/ai/expand-search-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
        .then((res) => res.json())
        .then((data: { terms?: string[] }) => {
          const terms = Array.isArray(data.terms) ? data.terms : []
          expansionCache.set(cacheKey, terms)
          if (requestIdRef.current === thisRequest) setExpansion({ query, terms })
        })
        .catch(() => {
          // fail-open: busca continua com o filtro direto, só sem a ampliação
        })
        .finally(() => {
          if (requestIdRef.current === thisRequest) setExpandingQuery(null)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, baseFiltered.length])

  const activeExtraTerms = useMemo(
    () => (expansion?.query === query ? expansion.terms : []),
    [expansion, query]
  )
  const expanding = expandingQuery === query

  const filtered = useMemo(
    () => (activeExtraTerms.length > 0 ? filterTransactions(transactions, query, activeExtraTerms) : baseFiltered),
    [transactions, query, activeExtraTerms, baseFiltered]
  )

  return {
    filtered,
    expanding,
    aiAssisted: activeExtraTerms.length > 0 && filtered.length > 0,
  }
}
