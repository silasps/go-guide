import type { MediaAspectRatio } from '@/types/database'

export const ASPECT_RATIOS: Partial<Record<MediaAspectRatio, number>> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
  '21:9': 21 / 9,
}

export const RATIO_TOLERANCE = 0.02

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = url
  })
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
 * post. Sem zoom (zoom=1, o padrão): a imagem inteira é mantida — se a
 * proporção não bate com a escolhida, sobra vira preenchimento com a cor
 * média da própria foto (nunca corta nada sem o usuário pedir). Com zoom
 * (>1, escolha explícita de recortar): recorta pra preencher o quadro,
 * igual antes.
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
  const ratioMatches = Math.abs(naturalRatio - targetRatio) / targetRatio < RATIO_TOLERANCE

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado.')

  if (zoom === 1 && !ratioMatches) {
    // Contain: mantém a foto inteira, preenche a sobra com a cor média dela.
    const boxWidth = naturalRatio > targetRatio ? iw : ih * targetRatio
    const boxHeight = naturalRatio > targetRatio ? iw / targetRatio : ih
    canvas.width = Math.round(boxWidth)
    canvas.height = Math.round(boxHeight)
    ctx.fillStyle = averageColor(img)
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Desloca dentro da sobra conforme a posição escolhida — o eixo sem
    // folga (imagem já preenche exatamente aquela dimensão) não se move,
    // mesma semântica de object-fit:contain + object-position no editor.
    const dx = (canvas.width - iw) * (params.position.x / 100)
    const dy = (canvas.height - ih) * (params.position.y / 100)
    if (params.cssFilter) ctx.filter = params.cssFilter
    ctx.drawImage(img, dx, dy, iw, ih)
  } else {
    // Cover: recorta a região escolhida (pan + zoom) pra preencher o quadro.
    let cropWidth = iw
    let cropHeight = ih
    if (naturalRatio > targetRatio) {
      cropWidth = ih * targetRatio
    } else {
      cropHeight = iw / targetRatio
    }
    cropWidth = cropWidth / zoom
    cropHeight = cropHeight / zoom

    const cropX = (iw - cropWidth) * (params.position.x / 100)
    const cropY = (ih - cropHeight) * (params.position.y / 100)

    canvas.width = Math.round(cropWidth)
    canvas.height = Math.round(cropHeight)
    if (params.cssFilter) ctx.filter = params.cssFilter
    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
  if (!blob) throw new Error('Não foi possível gerar a imagem recortada.')

  return new File([blob], params.fileName, { type: 'image/jpeg' })
}
