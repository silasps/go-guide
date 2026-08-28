import type { MediaAspectRatio } from '@/types/database'

export const ASPECT_RATIOS: Partial<Record<MediaAspectRatio, number>> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '1.91:1': 1.91,
  '21:9': 21 / 9,
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = url
  })
}

/** Calcula a cor média a partir de uma URL (em vez de um <img> já carregado)
 *  — usada pra computar `MediaDraft.bgColor` uma única vez, no momento em
 *  que a imagem é selecionada, e guardar no estado. Evitar recalcular via
 *  `onLoad` de cada preview (crop, ajustar, marcar pessoas) importa porque
 *  esse evento não dispara de forma confiável quando o navegador já tem a
 *  mesma blob URL em cache (comum aqui: a mesma imagem é montada de novo em
 *  cada etapa do composer) — o fundo ficava preso no fallback preto. */
export async function averageColorFromUrl(url: string): Promise<string> {
  const img = await loadImage(url)
  return averageColor(img)
}

/** Cor média da imagem (canvas reduzido a 10x10 e média dos pixels) — usada
 *  pra preencher a sobra quando a imagem inteira cabe sem cortar, em vez de
 *  uma cor de fundo desconexa da paleta da foto. Exportada porque o editor de
 *  recorte usa a mesma conta pra mostrar o preview igual ao resultado final. */
export function averageColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = 10
  canvas.height = 10
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#000'
  ctx.drawImage(img, 0, 0, 10, 10)
  const { data } = ctx.getImageData(0, 0, 10, 10)
  let r = 0, g = 0, b = 0
  const count = data.length / 4
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2] }
  return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`
}

/**
 * Reproduz em canvas o que o usuário viu na tela e "assa" o resultado — o
 * arquivo final já sai pronto, sem precisar guardar crop/filtro separado do
 * post. `zoom` é contínuo a partir de 1 (foto inteira visível, sobra
 * preenchida com a cor média dela) e `position` é um deslocamento livre nos
 * dois eixos (`50` = centralizado, sem deslocamento), independente do
 * zoom — mesma matemática do editor (`transform: translate(...) scale(...)`
 * sobre um `object-fit: contain`): primeiro centraliza a imagem já escalada
 * pelo zoom, depois desloca por um valor fixo em pixels do quadro (não
 * afetado pela escala, do mesmo jeito que um `translate()` depois de um
 * `scale()` em CSS).
 */
export async function bakeImage(params: {
  previewUrl: string
  fileName: string
  position: { x: number; y: number }
  zoom: number
  aspect: MediaAspectRatio
  cssFilter?: string
}): Promise<File> {
  const img = await loadImage(params.previewUrl)
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const targetRatio = ASPECT_RATIOS[params.aspect] ?? iw / ih
  const naturalRatio = iw / ih
  const zoom = Math.max(1, params.zoom)

  const boxWidth = naturalRatio > targetRatio ? iw : ih * targetRatio
  const boxHeight = naturalRatio > targetRatio ? iw / targetRatio : ih

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(boxWidth)
  canvas.height = Math.round(boxHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado.')

  ctx.fillStyle = averageColor(img)
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const panX = ((params.position.x - 50) / 100) * canvas.width
  const panY = ((params.position.y - 50) / 100) * canvas.height
  const drawWidth = iw * zoom
  const drawHeight = ih * zoom
  const drawX = (canvas.width - drawWidth) / 2 + panX
  const drawY = (canvas.height - drawHeight) / 2 + panY

  if (params.cssFilter) ctx.filter = params.cssFilter
  ctx.drawImage(img, 0, 0, iw, ih, drawX, drawY, drawWidth, drawHeight)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
  if (!blob) throw new Error('Não foi possível gerar a imagem recortada.')

  return new File([blob], params.fileName, { type: 'image/jpeg' })
}
