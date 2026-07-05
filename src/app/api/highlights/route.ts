import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { highlightId, profileId, title, description, goalTypes, goalAmount, currentAmount,
    currency, coverUrl, coverPosition, tripStartDate, fundingDeadline, scripture, letter, status, milestones, budgetCategories } = body

  const payload = {
    profile_id: profileId,
    title,
    description: description || null,
    goal_type: goalTypes.length > 0 ? goalTypes : ['ongoing'],
    goal_amount: goalAmount ?? null,
    current_amount: currentAmount ?? 0,
    currency,
    cover_url: coverUrl ?? null,
    cover_position: coverPosition,
    trip_start_date: tripStartDate ?? null,
    funding_deadline: fundingDeadline ?? null,
    scripture: scripture || null,
    letter: letter || null,
    status,
    slug: slugify(title),
  }

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
      const created = await dbPost('highlights', { ...payload, order_index: nextOrder })
      hId = created[0]?.id
    }

    if (hId) {
      await dbDelete(`milestones?highlight_id=eq.${hId}`)
      if (milestones.length > 0) {
        await dbPost('milestones', milestones.map((m: { title: string; is_completed: boolean }, i: number) => ({
          highlight_id: hId,
          profile_id: profileId,
          title: m.title,
          is_completed: m.is_completed,
          completed_at: m.is_completed ? new Date().toISOString() : null,
          order_index: i,
        })))
      }

      await dbDelete(`project_budget_categories?highlight_id=eq.${hId}`)
      if (Array.isArray(budgetCategories) && budgetCategories.length > 0) {
        await dbPost('project_budget_categories', budgetCategories.map((b: { category_type: string; custom_label: string | null; target_amount: number }, i: number) => ({
          highlight_id: hId,
          category_type: b.category_type,
          custom_label: b.custom_label,
          target_amount: b.target_amount,
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
