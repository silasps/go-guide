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

/** Termos relacionados ao termo buscado, achados no dicionário local — sem
 *  nenhuma chamada de rede, sempre instantâneo. Devolve `[]` quando o
 *  termo não bate em nenhum grupo conhecido (dicionário deliberadamente
 *  não é exaustivo). */
export function localRelatedTerms(query: string): string[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const related = new Set<string>()
  for (const token of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (!group.includes(token)) continue
      for (const term of group) {
        if (term !== token) related.add(term)
      }
    }
  }
  return Array.from(related)
}
