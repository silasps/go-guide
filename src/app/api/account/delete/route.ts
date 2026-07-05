import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function collectAllFiles(admin: Awaited<ReturnType<typeof createServiceClient>>, bucket: string, prefix: string): Promise<string[]> {
  const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (!entries) return []

  const files: string[] = []
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`
    if (entry.id === null) {
      // é uma "pasta" (sem metadata de arquivo) — desce recursivamente
      files.push(...await collectAllFiles(admin, bucket, path))
    } else {
      files.push(path)
    }
  }
  return files
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { confirm } = await req.json()

  const { data: profile } = await supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle()

  // Se o usuário tem um perfil de missionário, exige digitar o username. Caso contrário
  // (usuário é só parceiro, sem perfil próprio), exige a palavra EXCLUIR.
  const expected = profile?.username ?? 'EXCLUIR'
  if (confirm !== expected) {
    return NextResponse.json({ error: 'Confirmação incorreta.' }, { status: 400 })
  }

  const admin = await createServiceClient()

  // Apaga arquivos de mídia/avatar nas pastas do usuário (o dono real dos arquivos
  // sempre é a pasta com o auth uid, ver correção em highlight-form/pledge-form/profile-form).
  for (const bucket of ['media', 'avatars']) {
    const files = await collectAllFiles(admin, bucket, user.id)
    if (files.length > 0) {
      await admin.storage.from(bucket).remove(files)
    }
  }

  // Apaga o usuário do Auth — isso dispara os ON DELETE CASCADE/SET NULL configurados
  // nas migrations para todas as tabelas (perfil, projetos, financeiro, parceiros,
  // mensagens, pedidos de oração, chaves de criptografia, etc).
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
