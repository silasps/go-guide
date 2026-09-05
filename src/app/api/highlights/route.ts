import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'
import type { BudgetCategoryType } from '@/types/database'

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function dbPost(path: string, body: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(Array.isArray(data) ? data[0]?.message : data?.message ?? JSON.stringify(data))
  return data
}

async function dbPatch(path: string, body: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data?.message ?? JSON.stringify(data))
  }
}

async function dbDelete(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  await fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
}

async function dbGet(path: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  return res.json()
}

async function assertProfileAccess(profileId: string, userId: string) {
  const profiles = await dbGet(`profiles?id=eq.${profileId}&select=user_id`)
  if (!profiles[0]) throw Object.assign(new Error('Perfil não encontrado'), { status: 404 })
  if (profiles[0].user_id === userId) return
  const managers = await dbGet(`profile_managers?profile_id=eq.${profileId}&user_id=eq.${userId}&role=eq.manager&select=id`)
  if (managers.length === 0) throw Object.assign(new Error('Não autorizado'), { status: 403 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { highlightId, profileId, title, description, goalTypes, category, goalAmount, currentAmount,
    currency, coverUrl, coverPosition, coverMediaType, coverStatus, coverBunnyVideoId, tripStartDate, fundingDeadline, scripture, letter, status, milestones, budgetCategories,
    prayerPoints, galleryImages, originalLocale, titleTranslations, descriptionTranslations, scriptureTranslations, letterTranslations,
    letterImageUrl, letterImageCaption, letterImageUrl2, letterImageCaption2 } = body

  try {
    await assertProfileAccess(profileId, user.id)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 403
    const msg = err instanceof Error ? err.message : 'Não autorizado'
    return NextResponse.json({ error: msg }, { status })
  }

  // Rede de segurança server-side pro mesmo requisito já validado no
  // client (highlight-form.tsx/use-project-composer.ts) — só na criação;
  // projetos antigos sem capa continuam editáveis normalmente.
  if (!highlightId && !coverUrl && !coverBunnyVideoId) {
    return NextResponse.json({ error: 'Adicione uma foto de capa antes de salvar.' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {
    profile_id: profileId,
    title,
    description: description || null,
    goal_type: goalTypes.length > 0 ? goalTypes : ['ongoing'],
    category: Array.isArray(category) ? category : [],
    goal_amount: goalAmount ?? null,
    current_amount: currentAmount ?? 0,
    currency,
    cover_position: coverPosition,
    cover_media_type: coverMediaType ?? 'image',
    cover_status: coverStatus ?? 'ready',
    cover_bunny_video_id: coverBunnyVideoId ?? null,
    trip_start_date: tripStartDate ?? null,
    funding_deadline: fundingDeadline ?? null,
    scripture: scripture || null,
    letter: letter || null,
    letter_image_url: letterImageUrl || null,
    letter_image_caption: letterImageCaption || null,
    letter_image_url_2: letterImageUrl2 || null,
    letter_image_caption_2: letterImageCaption2 || null,
    status,
    original_locale: originalLocale ?? 'pt',
    title_translations: titleTranslations ?? {},
    description_translations: descriptionTranslations ?? {},
    scripture_translations: scriptureTranslations ?? {},
    letter_translations: letterTranslations ?? {},
  }
  // coverUrl vem ausente quando um vídeo novo ainda está sendo processado
  // pela Bunny — não sobrescreve a capa atual até o webhook confirmar.
  if (coverUrl !== undefined) payload.cover_url = coverUrl

  try {
    let hId = highlightId

    if (hId) {
      await dbPatch(`highlights?id=eq.${hId}`, payload)
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const lastRes = await fetch(`${url}/rest/v1/highlights?profile_id=eq.${profileId}&select=order_index&order=order_index.desc&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      const lastData = await lastRes.json()
      const nextOrder = (lastData[0]?.order_index ?? -1) + 1
      // slug só é gerado na criação — editar o título depois NÃO muda o
      // slug (ver migration 058), senão todo link de projeto já
      // compartilhado quebra silenciosamente a cada troca de nome.
      const created = await dbPost('highlights', { ...payload, slug: slugify(title), order_index: nextOrder })
      hId = created[0]?.id
    }

    if (hId) {
      await dbDelete(`milestones?highlight_id=eq.${hId}`)
      if (milestones.length > 0) {
        await dbPost('milestones', milestones.map((m: { title: string; titleTranslations?: Record<string, unknown>; is_completed: boolean }, i: number) => ({
          highlight_id: hId,
          profile_id: profileId,
          title: m.title,
          title_translations: m.titleTranslations ?? {},
          is_completed: m.is_completed,
          completed_at: m.is_completed ? new Date().toISOString() : null,
          order_index: i,
        })))
      }

      await dbDelete(`project_budget_categories?highlight_id=eq.${hId}`)
      let createdBudgetCategories: { id: string }[] = []
      if (Array.isArray(budgetCategories) && budgetCategories.length > 0) {
        createdBudgetCategories = await dbPost('project_budget_categories', budgetCategories.map((b: { category_type: string; custom_label: string | null; description: string | null; target_amount: number }, i: number) => ({
          highlight_id: hId,
          category_type: b.category_type,
          custom_label: b.custom_label,
          description: b.description,
          target_amount: b.target_amount,
          order_index: i,
        })))
      }

      // Pontos de oração: os "soltos" (prayerPoints) e os vinculados a uma
      // necessidade financeira (budgetCategories[i].prayerPoint) viram a
      // mesma tabela — o vínculo usa o id recém-gerado de
      // createdBudgetCategories (o delete-e-reinsere acima troca os ids a
      // cada save, então só dá pra linkar depois do insert de verdade).
      await dbDelete(`project_prayer_points?highlight_id=eq.${hId}`)
      type BudgetCategoryInput = { category_type: BudgetCategoryType; custom_label: string | null; prayerPoint?: string | null }
      const standalonePrayerPoints = Array.isArray(prayerPoints) ? prayerPoints : []
      const linkedPrayerPoints = (Array.isArray(budgetCategories) ? (budgetCategories as BudgetCategoryInput[]) : [])
        .map((b, i) => ({ b, category: createdBudgetCategories[i] }))
        .filter((x): x is { b: BudgetCategoryInput; category: { id: string } } => Boolean(x.b.prayerPoint) && Boolean(x.category))
        .map(({ b, category }) => ({
          budget_category_id: category.id,
          title: resolveBudgetCategoryLabel({ category_type: b.category_type, custom_label: b.custom_label }),
          description: b.prayerPoint,
        }))
      const allPrayerPoints = [
        ...standalonePrayerPoints.map((p: { title: string; description: string | null; is_completed: boolean }) => ({
          title: p.title, description: p.description, is_completed: p.is_completed, completed_at: p.is_completed ? new Date().toISOString() : null,
        })),
        ...linkedPrayerPoints,
      ]
      if (allPrayerPoints.length > 0) {
        await dbPost('project_prayer_points', allPrayerPoints.map((p, i) => ({ ...p, highlight_id: hId, order_index: i })))
      }

      await dbDelete(`project_gallery_images?highlight_id=eq.${hId}`)
      if (Array.isArray(galleryImages) && galleryImages.length > 0) {
        await dbPost('project_gallery_images', galleryImages.map((url: string, i: number) => ({
          highlight_id: hId,
          image_url: url,
          order_index: i,
        })))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
