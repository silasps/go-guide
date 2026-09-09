// Dicionário local de termos relacionados, em português — reforço de
// busca de lançamentos SEM depender de IA (ver `useTransactionSearch`).
// Usado como fallback quando a chamada à IA falha de verdade (rede, chave
// ausente, erro do provedor — ver `expandSearchTerms`), pra não deixar o
// usuário sem nenhuma ajuda além do filtro literal só porque o provedor
// de IA está indisponível.
//
// Cada grupo é um conjunto de palavras que se relacionam entre si —
// buscar QUALQUER uma encontra as outras do mesmo grupo (bidirecional:
// buscar "netflix" também acha "filme"/"streaming", não só o contrário).
// Cobertura deliberadamente enxuta (categorias comuns de gasto pessoal),
// não é uma ampliação tão rica quanto a IA ancorada nos dados reais do
// usuário — é o "menos pior" quando essa não está disponível.
const SYNONYM_GROUPS: string[][] = [
  ['filme', 'streaming', 'netflix', 'hbo max', 'disney+', 'amazon prime', 'paramount+', 'globoplay', 'cinema', 'ingresso'],
  ['remedio', 'farmacia', 'droga raia', 'drogasil', 'pacheco', 'drogaria', 'medicamento'],
  ['roupa', 'vestuario', 'camiseta', 'calca', 'blusa', 'sapato', 'vestido', 'jaqueta', 'renner', 'c&a', 'zara', 'riachuelo'],
  ['mercado', 'supermercado', 'alimentacao', 'compras', 'carrefour', 'extra', 'pao de acucar', 'assai', 'atacadao'],
  ['transporte', 'uber', '99', 'taxi', 'combustivel', 'gasolina', 'estacionamento'],
  ['carro', 'veiculo', 'oficina', 'mecanico', 'pneu', 'ipva', 'seguro auto'],
  ['viagem', 'passagem', 'hotel', 'pousada', 'airbnb', 'latam', 'gol', 'azul'],
  ['academia', 'gympass', 'totalpass', 'smartfit', 'personal'],
  ['pet', 'petshop', 'veterinario', 'racao', 'cobasi', 'petz'],
  ['educacao', 'escola', 'faculdade', 'curso', 'mensalidade', 'material escolar'],
  ['internet', 'telefone', 'celular', 'vivo', 'claro', 'tim', 'oi', 'wifi'],
  ['lazer', 'diversao', 'passeio', 'parque'],
  ['saude', 'plano de saude', 'unimed', 'hapvida', 'consulta', 'exame', 'hospital'],
  ['casa', 'moradia', 'aluguel', 'condominio', 'iptu', 'reforma'],
  ['beleza', 'salao', 'cabelo', 'manicure', 'estetica', 'cosmetico'],
  ['presente', 'aniversario', 'natal'],
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Gera possíveis formas "singulares" de uma palavra, tentando os padrões
// regulares de plural do português (vogal -> +s, r/s/z -> +es, m -> +ns,
// l -> +is/+eis). Não escolhe UMA resposta — devolve todas as reduções
// plausíveis, incluindo a palavra original, e deixa quem chama checar
// contra o dicionário real qual delas (se alguma) é uma entrada
// conhecida. Isso evita ter que adivinhar sozinho se "es" no final é
// "vogal+s que por acaso termina em es" (exame -> exames) ou "consoante
// r/s/z + es" (celular -> celulares) — ambas as reduções candidatas são
// geradas, e só uma bate numa entrada real do dicionário, então a
// ambiguidade se resolve pela própria busca, não por uma regra cega.
function candidateSingulars(word: string): string[] {
  const candidates = new Set([word])
  if (word.length > 3) {
    if (word.endsWith('ns')) candidates.add(`${word.slice(0, -2)}m`) // viagens -> viagem
    if (word.endsWith('ais')) candidates.add(`${word.slice(0, -3)}al`) // hospitais -> hospital
    if (word.endsWith('eis')) candidates.add(`${word.slice(0, -3)}el`) // hoteis -> hotel
    if (word.endsWith('es') && word.length > 4) candidates.add(word.slice(0, -2)) // celulares -> celular, meses -> mes
    if (word.endsWith('s')) candidates.add(word.slice(0, -1)) // filmes -> filme, exames -> exame, manicures -> manicure
  }
  return Array.from(candidates)
}

// Grupos pré-normalizados uma vez só no carregamento do módulo.
const NORMALIZED_GROUPS: string[][] = SYNONYM_GROUPS.map((group) => group.map((term) => normalize(term)))

// Tamanho mínimo pra um candidato "bater por prefixo" numa entrada do
// dicionário — busca incremental (usuário ainda digitando: "film" deve
// já sugerir o grupo de "filme") sem deixar qualquer coisinha de 1-2
// letras acender meio dicionário à toa.
const MIN_PREFIX_LENGTH = 3

function candidateMatchesEntry(candidates: string[], entry: string): boolean {
  return candidates.some((c) => c === entry || (c.length >= MIN_PREFIX_LENGTH && entry.startsWith(c)))
}

/** Termos relacionados ao termo buscado, achados no dicionário local — sem
 *  nenhuma chamada de rede, sempre instantâneo. Devolve `[]` quando o
 *  termo não bate em nenhum grupo conhecido (dicionário deliberadamente
 *  não é exaustivo). Tolerante a variações de plural (ver
 *  `candidateSingulars`) e a busca incremental — um prefixo de pelo menos
 *  3 letras já ativa o grupo (`candidateMatchesEntry`), pra funcionar
 *  enquanto a pessoa ainda está digitando a palavra, não só quando ela
 *  termina de escrevê-la. */
export function localRelatedTerms(query: string): string[] {
  const rawTokens = normalize(query).split(/\s+/).filter(Boolean)
  if (rawTokens.length === 0) return []

  const related = new Set<string>()
  for (const rawToken of rawTokens) {
    const candidates = candidateSingulars(rawToken)
    NORMALIZED_GROUPS.forEach((group, groupIndex) => {
      const matchIndex = group.findIndex((entry) => candidateMatchesEntry(candidates, entry))
      if (matchIndex === -1) return
      SYNONYM_GROUPS[groupIndex].forEach((term, i) => {
        if (i !== matchIndex) related.add(term)
      })
    })
  }
  return Array.from(related)
}
