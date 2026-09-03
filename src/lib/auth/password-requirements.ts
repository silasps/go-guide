// Mesmo conjunto de símbolos que o Supabase Auth exige (política configurada
// no projeto: minúscula + maiúscula + dígito + símbolo, min. 8 caracteres) —
// replicado aqui pra validar no cliente antes de bater na API e mostrar o
// checklist ao vivo. Ver AuthWeakPasswordError em signUp/updateUser.
const SYMBOL_REGEX = /[@#$%^&*()_+=[\]{};':"|<>?,./`~!-]/

export type PasswordRequirementKey = 'length' | 'lowercase' | 'uppercase' | 'digit' | 'symbol'

export const PASSWORD_REQUIREMENTS: { key: PasswordRequirementKey; test: (password: string) => boolean }[] = [
  { key: 'length', test: (password) => password.length >= 8 },
  { key: 'lowercase', test: (password) => /[a-z]/.test(password) },
  { key: 'uppercase', test: (password) => /[A-Z]/.test(password) },
  { key: 'digit', test: (password) => /[0-9]/.test(password) },
  { key: 'symbol', test: (password) => SYMBOL_REGEX.test(password) },
]

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password))
}
