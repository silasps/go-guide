import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Locale } from '@/i18n/config'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const INTL_LOCALE: Record<Locale, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }

// Numérico (dd/mm/aaaa, adaptado à ordem de cada locale) em vez de
// "18 de set. de 2026" — no formato por extenso, o conector "de" (pt) e o
// nome do mês empurram a data pra fora do pill de badge em telas estreitas
// (feedback do usuário: badge "Prazo" cortado/coberto pelo lápis de editar).
export function formatShortDate(date: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return formatDate(date)
}

/** Dias corridos desde `date` até agora, sempre >= 0 — usado onde "quantos
 *  dias" precisa continuar explícito mesmo depois de uma semana (diferente
 *  de formatRelativeTime, que vira data formatada e perde a contagem). */
export function daysSince(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function planLimits(plan: string) {
  const limits = {
    free: { partners: 2, postsPerMonth: 1, aiCreditsIncluded: 0, managersIncluded: 0 },
    pro: { partners: Infinity, postsPerMonth: Infinity, aiCreditsIncluded: 50, managersIncluded: 1 },
    mission: { partners: Infinity, postsPerMonth: Infinity, aiCreditsIncluded: 150, managersIncluded: 2 },
  }
  return limits[plan as keyof typeof limits] ?? limits.free
}
