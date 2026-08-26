import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBunnyVideo, signBunnyTusUpload } from '@/lib/media/bunny'

// Rota genérica — cria o objeto de vídeo na Bunny e assina o upload TUS.
// Usada tanto pelo vídeo de post quanto pelo vídeo de capa de projeto;
// não sabe (nem precisa saber) qual dos dois é.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const { title } = await req.json()
    const video = await createBunnyVideo(title ?? `${user.id}-${Date.now()}`)
    const { signature, expiration, libraryId } = signBunnyTusUpload(video.guid)
    return NextResponse.json({ videoId: video.guid, signature, expiration, libraryId })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao iniciar upload' }, { status: 500 })
  }
}
