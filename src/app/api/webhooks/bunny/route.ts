import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getBunnyVideo, deleteBunnyVideo, bunnyPlaybackUrl, verifyBunnyWebhookSignature, BUNNY_STATUS_FINISHED, BUNNY_STATUS_FAILED } from '@/lib/media/bunny'
import { VIDEO_MAX_DURATION_SECONDS } from '@/lib/media/compress'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyBunnyWebhookSignature(rawBody, req.headers.get('X-BunnyStream-Signature'))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const { VideoGuid, Status } = JSON.parse(rawBody) as { VideoGuid: string; Status: number }
  const supabase = await createServiceClient()

  if (Status === BUNNY_STATUS_FAILED) {
    await supabase.from('highlights').update({ cover_status: 'failed' }).eq('cover_bunny_video_id', VideoGuid)
    await supabase.from('posts').update({ media_status: 'failed' }).eq('media_bunny_video_id', VideoGuid)
    return NextResponse.json({ ok: true })
  }

  if (Status !== BUNNY_STATUS_FINISHED) return NextResponse.json({ ok: true })

  // Confere a duração real na Bunny — o check no client (antes do upload)
  // pode ser burlado, então a fonte de verdade é sempre o servidor.
  const video = await getBunnyVideo(VideoGuid)
  if (video.length > VIDEO_MAX_DURATION_SECONDS + 5) {
    await deleteBunnyVideo(VideoGuid)
    await supabase.from('highlights').update({ cover_status: 'failed' }).eq('cover_bunny_video_id', VideoGuid)
    await supabase.from('posts').update({ media_status: 'failed' }).eq('media_bunny_video_id', VideoGuid)
    return NextResponse.json({ ok: true })
  }

  const playbackUrl = bunnyPlaybackUrl(VideoGuid)

  const { count: highlightCount } = await supabase
    .from('highlights')
    .update({ cover_url: playbackUrl, cover_media_type: 'video', cover_status: 'ready' }, { count: 'exact' })
    .eq('cover_bunny_video_id', VideoGuid)

  if (!highlightCount) {
    await supabase.from('posts').update({ media_urls: [playbackUrl], media_status: 'ready' }).eq('media_bunny_video_id', VideoGuid)
  }

  return NextResponse.json({ ok: true })
}
