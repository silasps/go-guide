import Image from 'next/image'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { Profile } from '@/types/database'
import { getInitials } from '@/lib/utils'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import type { Locale } from '@/i18n/config'
import { MapPin, Link2 } from 'lucide-react'

interface Props {
  profile: Profile
  postsCount: number
  projectsCount: number
  achievementsCount: number
  followersCount?: number
  followingCount?: number
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export async function ProfileHeader({ profile, postsCount, projectsCount, achievementsCount, followersCount, followingCount }: Props) {
  const t = await getTranslations('PublicProfile')
  const locale = (await getLocale()) as Locale
  const isPublic = profile.privacy_mode === 'public'
  const displayName = profile.privacy_mode === 'stealth' ? t('missionaryFallbackName') : profile.display_name

  const bio = resolveLocalizedText(profile.bio, profile.bio_locale, profile.bio_translations, locale).text
  const showFollows = profile.user_role === 'missionary' && followersCount !== undefined && followingCount !== undefined

  const stats = [
    { value: postsCount, label: t('statsPosts') },
    { value: projectsCount, label: t('statsProjects') },
    { value: achievementsCount, label: t('statsAchievements') },
  ]

  return (
    <div className="space-y-4">
      {/* Avatar + estatísticas, estilo Instagram */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              width={80}
              height={80}
              className="rounded-full object-cover ring-2 ring-border"
              style={{ width: 80, height: 80 }}
            />
          ) : (
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-2 ring-border"
              style={{ backgroundColor: profile.accent_color }}
            >
              {getInitials(displayName)}
            </div>
          )}
        </div>

        <div className="flex-1 grid grid-cols-3 text-center">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <div className="text-base font-semibold leading-tight">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Seguidores/Seguindo — só para missionários, linha própria pra caber bem no mobile */}
      {showFollows && (
        <Link href={`/${profile.username}/seguidores`} className="grid grid-cols-2 text-center rounded-xl border py-2">
          <div>
            <span className="text-sm font-semibold">{followersCount}</span>{' '}
            <span className="text-xs text-muted-foreground">{t('statsFollowers')}</span>
          </div>
          <div className="border-l">
            <span className="text-sm font-semibold">{followingCount}</span>{' '}
            <span className="text-xs text-muted-foreground">{t('statsFollowing')}</span>
          </div>
        </Link>
      )}

      {/* Nome + localização */}
      <div className="space-y-0.5">
        <h1 className="text-lg font-semibold leading-tight">{displayName}</h1>
        {isPublic && profile.show_location && profile.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {profile.location}
          </div>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">{bio}</p>
      )}

      {/* Links + redes sociais */}
      {isPublic && (
        <div className="flex flex-wrap items-center gap-3">
          {profile.website_url && (
            <Link href={profile.website_url} target="_blank" className="flex items-center gap-1 text-sm font-medium" style={{ color: profile.accent_color }}>
              <Link2 className="h-3.5 w-3.5" />
              {extractDomain(profile.website_url)}
            </Link>
          )}
          {profile.instagram_url && (
            <Link href={profile.instagram_url} target="_blank" className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
              Instagram
            </Link>
          )}
          {profile.youtube_url && (
            <Link href={profile.youtube_url} target="_blank" className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
              YouTube
            </Link>
          )}
          {profile.facebook_url && (
            <Link href={profile.facebook_url} target="_blank" className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
              Facebook
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
