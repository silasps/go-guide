// Único lugar que monta um link `wa.me` — antes duplicado em
// birthday-reminders.tsx e pledge-review-card.tsx.
export function buildWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}
