// Allowlist por variável de ambiente (não coluna em `profiles`) — evita
// abrir superfície nova de RLS ou risco de alguém se auto-promover a
// superadmin via client. Checado só no servidor, mesmo padrão de CRON_SECRET.
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
