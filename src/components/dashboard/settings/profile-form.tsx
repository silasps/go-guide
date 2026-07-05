'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { Profile } from '@/types/database'
import { AccountTypeSelector, useAccountTypeCopy } from '@/components/profile/account-type-selector'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Camera, Check, X } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export function ProfileForm({ profile }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [accountType, setAccountType] = useState(profile.account_type)
  const { bioPlaceholder, bioHint, displayNamePlaceholder } = useAccountTypeCopy(accountType)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [showLocation, setShowLocation] = useState(profile.show_location ?? true)
  const [missionStartDate, setMissionStartDate] = useState(profile.mission_start_date ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? '')
  const [instagramUrl, setInstagramUrl] = useState(profile.instagram_url ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(profile.youtube_url ?? '')
  const [facebookUrl, setFacebookUrl] = useState(profile.facebook_url ?? '')
  const [tiktokUrl, setTiktokUrl] = useState(profile.tiktok_url ?? '')

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameTimer, setUsernameTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setAvatarFile(compressed)
    setAvatarPreview(URL.createObjectURL(compressed))
  }

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    setUsernameStatus('idle')

    if (usernameTimer) clearTimeout(usernameTimer)
    if (value === profile.username || value.length < 3) return

    if (!/^[a-z][a-z0-9_]{2,29}$/.test(value)) {
      setUsernameStatus('invalid')
      return
    }

    const timer = setTimeout(() => checkUsername(value), 500)
    setUsernameTimer(timer)
    setUsernameStatus('checking')
  }

  async function checkUsername(value: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', value)
      .neq('id', profile.id)
      .maybeSingle()
    setUsernameStatus(data ? 'taken' : 'available')
  }

  async function handleSave() {
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return
    setSaving(true)
    const supabase = createClient()

    let avatar_url = profile.avatar_url
    if (avatarFile) {
      const ext = 'webp'
      const path = `${profile.user_id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: 'image/webp' })
      if (uploadError) {
        toast.error('Erro ao enviar foto.')
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      avatar_url = `${urlData.publicUrl}?t=${Date.now()}`
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        account_type: accountType,
        username,
        bio: bio || null,
        location: location || null,
        show_location: showLocation,
        mission_start_date: missionStartDate || null,
        avatar_url,
        website_url: websiteUrl || null,
        instagram_url: instagramUrl || null,
        youtube_url: youtubeUrl || null,
        facebook_url: facebookUrl || null,
        tiktok_url: tiktokUrl || null,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Erro ao salvar perfil.')
    } else {
      toast.success('Perfil atualizado!')
      localStorage.removeItem('profile-banner-dismissed')
      router.refresh()
    }
    setSaving(false)
  }

  const usernameIcon = useCallback(() => {
    if (usernameStatus === 'checking') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    if (usernameStatus === 'available') return <Check className="h-3.5 w-3.5 text-green-500" />
    if (usernameStatus === 'taken') return <X className="h-3.5 w-3.5 text-destructive" />
    if (usernameStatus === 'invalid') return <X className="h-3.5 w-3.5 text-destructive" />
    return null
  }, [usernameStatus])

  return (
    <div className="space-y-6">
      {/* Avatar — Instagram-style: centered with tap-to-edit */}
      <div className="flex flex-col items-center gap-2 pb-2 border-b">
        <div className="relative">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarPreview ?? ''} alt={displayName} />
            <AvatarFallback className="text-xl">{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-primary hover:opacity-80 transition-opacity"
        >
          Editar foto de perfil
        </button>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máx 5MB</p>
      </div>

      {/* Tipo de conta */}
      <div className="space-y-2">
        <Label>Este perfil representa</Label>
        <AccountTypeSelector value={accountType} onChange={setAccountType} />
      </div>

      {/* Nome e username */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="display_name">Nome de exibição</Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
            placeholder={displayNamePlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              id="username"
              value={username}
              onChange={handleUsernameChange}
              className="pl-7 pr-7"
              placeholder="seunome"
              maxLength={30}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameIcon()}
            </span>
          </div>
          {usernameStatus === 'taken' && <p className="text-xs text-destructive">Username indisponível.</p>}
          {usernameStatus === 'invalid' && <p className="text-xs text-destructive">Apenas letras minúsculas, números e _. Mínimo 3 chars.</p>}
          {usernameStatus === 'available' && <p className="text-xs text-green-600">@{username} disponível!</p>}
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <p className="text-xs text-muted-foreground">{bioHint}</p>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={bioPlaceholder}
          rows={3}
          maxLength={300}
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/300</p>
      </div>

      {/* Localização */}
      <div className="space-y-2">
        <Label htmlFor="location">Localização</Label>
        <Input
          id="location"
          value={location}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
          placeholder="Nairóbi, Quênia"
        />
        <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={showLocation}
            onChange={(e) => setShowLocation(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            Mostrar minha localização no perfil público
            <span className="block text-xs text-muted-foreground">Dado protegido: só aparece publicamente se esta opção estiver marcada.</span>
          </span>
        </label>
      </div>

      {/* Início da missão */}
      <div className="space-y-2">
        <Label htmlFor="mission_start_date">Em campo desde</Label>
        <Input
          id="mission_start_date"
          type="date"
          value={missionStartDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMissionStartDate(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Usado na chamada &quot;faça parte do que o Senhor está fazendo desde {'{ano}'}&quot; na tela de parceria.</p>
      </div>

      {/* Redes sociais */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Redes sociais</Label>
        {[
          { id: 'website', label: 'Site', value: websiteUrl, set: setWebsiteUrl, placeholder: 'https://seusite.com' },
          { id: 'instagram', label: 'Instagram', value: instagramUrl, set: setInstagramUrl, placeholder: 'https://instagram.com/seuperfil' },
          { id: 'youtube', label: 'YouTube', value: youtubeUrl, set: setYoutubeUrl, placeholder: 'https://youtube.com/@seucanal' },
          { id: 'facebook', label: 'Facebook', value: facebookUrl, set: setFacebookUrl, placeholder: 'https://facebook.com/seuperfil' },
          { id: 'tiktok', label: 'TikTok', value: tiktokUrl, set: setTiktokUrl, placeholder: 'https://tiktok.com/@seuperfil' },
        ].map(({ id, label, value, set, placeholder }) => (
          <div key={id} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
            <Label htmlFor={id} className="text-sm text-muted-foreground">{label}</Label>
            <Input
              id={id}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving || usernameStatus === 'taken' || usernameStatus === 'invalid'}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar alterações
      </Button>
    </div>
  )
}
