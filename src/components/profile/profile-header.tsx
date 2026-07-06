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
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

export async function ProfileHeader({ profile }: Props) {
  const t = await getTranslations('PublicProfile')
  const locale = (await getLocale()) as Locale
  const isPublic = profile.privacy_mode === 'public'
  const displayName = profile.privacy_mode === 'stealth' ? t('missionaryFallbackName') : profile.display_name

  const bio = resolveLocalizedText(profile.bio, profile.bio_locale, profile.bio_translations, locale).text

  const donationLink = profile.external_donation_url || profile.paypal_url || profile.wise_url

  return (
    <div className="space-y-4">
      {/* Avatar + nome */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              width={72}
              height={72}
              className="rounded-full object-cover ring-2 ring-border"
              style={{ width: 72, height: 72 }}
            />
          ) : (
            <div
              className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-white text-xl font-bold ring-2 ring-border"
              style={{ backgroundColor: profile.accent_color }}
            >
              {getInitials(displayName)}
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold leading-tight">{displayName}</h1>
          {isPublic && profile.show_location && profile.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {profile.location}
            </div>
          )}
        </div>
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

      {/* Pix badge */}
      {profile.pix_key && !donationLink && (
        <span className="inline-block text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
          {t('pixAvailable')}
        </span>
      )}
    </div>
  )
}
