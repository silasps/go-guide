/** Junta partes de um lugar (nome, cidade, estado, país — a ordem que cada
 *  provider extrai da própria resposta) no mesmo formato usado em todo o
 *  app: "Local, Cidade, Estado, País". Remove vazios e duplicatas (ex.:
 *  quando o nome do lugar já É o nome da cidade). */
export function joinLocationParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((part, i, arr): part is string => Boolean(part) && arr.indexOf(part) === i)
    .join(', ')
}
