export interface PartnerBirthdayInfo {
  id: string
  name: string
  phone: string | null
  user_id: string | null
  birth_date: string | null
}

export interface UpcomingBirthday {
  partner: PartnerBirthdayInfo
  nextBirthday: Date
  daysUntil: number
  turningAge: number
}

function parseDateOnly(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getUpcomingBirthdays(partners: PartnerBirthdayInfo[], withinDays = 14): UpcomingBirthday[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result: UpcomingBirthday[] = []
  for (const partner of partners) {
    if (!partner.birth_date) continue
    const birth = parseDateOnly(partner.birth_date)
    let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
    if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
    const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000)
    if (daysUntil > withinDays) continue
    result.push({ partner, nextBirthday: next, daysUntil, turningAge: next.getFullYear() - birth.getFullYear() })
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil)
}
