import type { MediaAspectRatio } from '@/types/database'

const ASPECT_RATIOS: Partial<Record<MediaAspectRatio, number>> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = url
  })
}

/**
 * Reproduz em canvas o recorte que o usuário viu na tela (object-fit: cover
 * com object-position vindo do pan + zoom aplicado por cima) e "assa" o
 * resultado — o arquivo final já sai recortado/filtrado, sem precisar
 * guardar crop/filtro separadamente do post.
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

  let cropWidth = iw
  let cropHeight = ih
  if (iw / ih > targetRatio) {
    cropWidth = ih * targetRatio
  } else {
    cropHeight = iw / targetRatio
  }

  const zoom = Math.max(1, params.zoom)
  cropWidth = cropWidth / zoom
  cropHeight = cropHeight / zoom

  const cropX = (iw - cropWidth) * (params.position.x / 100)
  const cropY = (ih - cropHeight) * (params.position.y / 100)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cropWidth)
  canvas.height = Math.round(cropHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado.')
  if (params.cssFilter) ctx.filter = params.cssFilter
  ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
  if (!blob) throw new Error('Não foi possível gerar a imagem recortada.')

  return new File([blob], params.fileName, { type: 'image/jpeg' })
}
