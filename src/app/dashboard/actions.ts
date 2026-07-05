'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACTIVE_PROFILE_COOKIE } from '@/lib/profile/active-profile'

export async function setActiveProfile(profileId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  redirect('/dashboard')
}
