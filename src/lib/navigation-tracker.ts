// `window.history.length` não é confiável pra saber se "voltar" tem
// pra onde ir de verdade: abas novas (ex.: link compartilhado no
// WhatsApp) às vezes já chegam com length > 1 (conta uma entrada
// em branco antes da página carregada), então `router.back()` cai
// numa página em branco em vez de dar erro visível/óbvio. Em vez
// disso, rastreamos se alguma navegação de verdade já aconteceu
// dentro do próprio app nesta carga de página — `NavigationTracker`
// (montado uma vez no layout raiz) marca isso a cada troca de rota.
let hasNavigated = false

export function markInAppNavigation() {
  hasNavigated = true
}

export function hasInAppNavigation() {
  return hasNavigated
}
