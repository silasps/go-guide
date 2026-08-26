import * as tus from 'tus-js-client'

const BUNNY_TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload'

/** Sobe um vídeo direto pra Bunny Stream via TUS resumable upload — os
 *  bytes vão direto do navegador pra Bunny, nunca passam pelo nosso
 *  servidor (evita o limite de body de rota serverless) nem expõem a API
 *  key (o servidor só assina o upload, ver /api/media/bunny-video/init). */
export async function uploadVideoToBunny(file: File, onProgress?: (pct: number) => void): Promise<{ bunnyVideoId: string }> {
  const initRes = await fetch('/api/media/bunny-video/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: file.name }),
  })
  if (!initRes.ok) throw new Error('Não foi possível iniciar o upload do vídeo.')
  const { videoId, signature, expiration, libraryId } = await initRes.json()

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: BUNNY_TUS_ENDPOINT,
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expiration),
        VideoId: videoId,
        LibraryId: String(libraryId),
      },
      metadata: { filetype: file.type, title: file.name },
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100)),
      onSuccess: () => resolve(),
    })
    upload.start()
  })

  return { bunnyVideoId: videoId }
}
