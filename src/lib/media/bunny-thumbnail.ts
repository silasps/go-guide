/** Bunny Stream serve uma thumbnail .jpg automática ao lado do manifesto
 *  HLS de cada vídeo — usamos isso pra preencher miniaturas de projeto
 *  (grades, busca, listas) sem precisar guardar uma URL de thumbnail
 *  separada. Sem import de servidor: seguro pra usar em componente client. */
export function coverThumbnailSrc(url: string | null | undefined): string {
  if (!url) return ''
  return url.endsWith('/playlist.m3u8') ? url.replace('/playlist.m3u8', '/thumbnail.jpg') : url
}
