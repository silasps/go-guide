'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setDisplayName(name)
    setUsername(slugify(name))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!displayName.trim() || !username.trim()) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Check if profile already exists (created by trigger)
    const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()

    if (existing) {
      await supabase.from('profiles').update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
      }).eq('user_id', user.id)
    } else {
      await supabase.from('profiles').insert({
        user_id: user.id,
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
      })
    }

    setSaving(false)
    toast.success('Perfil criado!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Bem-vindo ao go→guide</h1>
          <p className="text-muted-foreground mt-2">Configure seu perfil para começar</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Seu perfil missionário</CardTitle>
            <CardDescription>Essas informações aparecem no seu perfil público.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="João e Maria Silva"
                  value={displayName}
                  onChange={handleNameChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Usuário *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">missao.app/</span>
                  <Input
                    className="pl-24"
                    placeholder="joaoemaria"
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea
                  placeholder="Missionários na África desde 2020..."
                  value={bio}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar meu perfil
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
