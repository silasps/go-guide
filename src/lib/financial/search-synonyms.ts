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
// Deliberadamente "pré-programado" pra além do que o usuário já lançou —
// a IA ancorada nos dados reais (ver `expand-search-terms.ts`) só
// consegue relacionar o que já existe nos lançamentos; esse dicionário
// aqui precisa cobrir também categoria que a pessoa ainda não lançou
// nenhuma vez (ex.: procurar "música" antes de existir qualquer
// lançamento de Spotify) — por isso a cobertura é mais ampla que só "as
// categorias mais comuns", tentando antecipar marcas/serviços conhecidos
// no Brasil pra cada assunto do dia a dia, não só o assunto em si.
// "streaming" aparece em mais de um grupo de propósito — a palavra sozinha
// é ambígua (vídeo ou música), então buscar por ela ativa os dois.
const SYNONYM_GROUPS: string[][] = [
  // Streaming de vídeo / filme
  ['filme', 'streaming', 'netflix', 'hbo max', 'disney+', 'amazon prime', 'paramount+', 'globoplay', 'star+', 'apple tv', 'crunchyroll', 'cinema', 'ingresso', 'serie'],
  // Streaming de música / áudio
  ['musica', 'audio', 'streaming', 'spotify', 'deezer', 'apple music', 'youtube music', 'amazon music', 'tidal', 'soundcloud', 'podcast'],
  // Jogos/games
  ['jogo', 'game', 'steam', 'playstation', 'psn', 'xbox', 'game pass', 'nintendo', 'switch', 'epic games'],
  // Livros/leitura
  ['livro', 'leitura', 'kindle', 'ebook', 'audiobook', 'audible', 'livraria', 'saraiva', 'estante virtual'],
  // Software/assinaturas digitais/nuvem
  ['assinatura', 'software', 'nuvem', 'icloud', 'google one', 'google drive', 'dropbox', 'office 365', 'microsoft 365', 'canva', 'adobe', 'chatgpt', 'notion'],
  // Remédio/farmácia
  ['remedio', 'farmacia', 'droga raia', 'drogasil', 'pacheco', 'drogaria', 'medicamento'],
  // Roupa/vestuário
  ['roupa', 'vestuario', 'camiseta', 'calca', 'blusa', 'sapato', 'vestido', 'jaqueta', 'renner', 'c&a', 'zara', 'riachuelo'],
  // Mercado/alimentação (compras de casa)
  ['mercado', 'supermercado', 'alimentacao', 'compras', 'carrefour', 'extra', 'pao de acucar', 'assai', 'atacadao'],
  // Delivery de comida
  ['delivery', 'ifood', 'rappi', 'uber eats', 'entrega', 'lanche'],
  // Restaurante/bar
  ['restaurante', 'bar', 'lanchonete', 'padaria', 'cafeteria', 'pizzaria', 'hamburgueria', 'bebida', 'cerveja'],
  // Transporte urbano
  ['transporte', 'uber', '99', 'taxi', 'combustivel', 'gasolina', 'estacionamento'],
  // Carro/veículo
  ['carro', 'veiculo', 'oficina', 'mecanico', 'pneu', 'ipva', 'seguro auto', 'lava rapido'],
  // Viagem
  ['viagem', 'passagem', 'hotel', 'pousada', 'airbnb', 'latam', 'gol', 'azul'],
  // Academia/exercício
  ['academia', 'gympass', 'totalpass', 'smartfit', 'personal'],
  // Pet
  ['pet', 'petshop', 'veterinario', 'racao', 'cobasi', 'petz'],
  // Educação
  ['educacao', 'escola', 'faculdade', 'curso', 'mensalidade', 'material escolar'],
  // Filhos/criança
  ['filho', 'crianca', 'fralda', 'escola infantil', 'creche', 'brinquedo', 'pediatra'],
  // Internet/telefone
  ['internet', 'telefone', 'celular', 'vivo', 'claro', 'tim', 'oi', 'wifi'],
  // Lazer geral
  ['lazer', 'diversao', 'passeio', 'parque'],
  // Saúde
  ['saude', 'plano de saude', 'unimed', 'hapvida', 'consulta', 'exame', 'hospital'],
  // Casa/moradia
  ['casa', 'moradia', 'aluguel', 'condominio', 'iptu', 'reforma'],
  // Beleza
  ['beleza', 'salao', 'cabelo', 'manicure', 'estetica', 'cosmetico'],
  // Presente
  ['presente', 'aniversario', 'natal'],
  // Investimentos
  ['investimento', 'poupanca', 'cdb', 'tesouro direto', 'acoes', 'corretora', 'bolsa'],
  // Impostos/taxas
  ['imposto', 'ir', 'imposto de renda', 'das', 'taxa', 'tarifa', 'iof'],
  // Seguros
  ['seguro', 'seguro de vida', 'seguro residencial', 'porto seguro'],
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
// dicionário — busca incremental de verdade: usuário digitando "fi" (só
// duas letras, ainda decidindo se vai escrever "filme") já deve ver o
// grupo relacionado, mesmo que descubra depois que não era isso que
// queria (pedido explícito do usuário — prefere ver relacionado demais
// enquanto digita do que nada). Mesmo mínimo que já libera QUALQUER
// tentativa de busca ampliada (`MIN_QUERY_LENGTH`, em
// `use-transaction-search.ts`) — não faz sentido um limiar mais alto só
// aqui dentro. Não é 1 letra: a essa altura ainda não há informação
// suficiente pra relacionar a quase nada, ficaria só ruído.
const MIN_PREFIX_LENGTH = 2

function candidateMatchesEntry(candidates: string[], entry: string): boolean {
  return candidates.some((c) => c === entry || (c.length >= MIN_PREFIX_LENGTH && entry.startsWith(c)))
}

/** Termos relacionados ao termo buscado, achados no dicionário local — sem
 *  nenhuma chamada de rede, sempre instantâneo. Devolve `[]` quando o
 *  termo não bate em nenhum grupo conhecido (dicionário deliberadamente
 *  não é exaustivo). Tolerante a variações de plural (ver
 *  `candidateSingulars`) e a busca incremental — um prefixo de pelo menos
 *  2 letras já ativa o grupo (`candidateMatchesEntry`), pra funcionar
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
