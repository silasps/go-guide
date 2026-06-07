import imageCompression from 'browser-image-compression'

const IMAGE_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  fileType: 'image/webp' as const,
  initialQuality: 0.85,
}

export const VIDEO_MAX_SIZE_MB = 500
export const VIDEO_MAX_SIZE_BYTES = VIDEO_MAX_SIZE_MB * 1024 * 1024

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  return imageCompression(file, IMAGE_OPTIONS)
}

export function validateVideo(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('video/')) return { valid: false, error: 'Arquivo não é um vídeo.' }
  if (file.size > VIDEO_MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `Vídeos acima de ${VIDEO_MAX_SIZE_MB}MB não são suportados. Compacte o vídeo antes de enviar.`,
    }
  }
  return { valid: true }
}

export function getMediaType(file: File): 'image' | 'video' | 'unknown' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'unknown'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
