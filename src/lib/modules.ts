import {
  UserCircle, FolderHeart, Users, Wallet, HeartHandshake, Lock, Bell,
  type LucideIcon,
} from 'lucide-react'

export type ModuleColor = 'indigo' | 'amber' | 'blue' | 'emerald' | 'rose' | 'violet' | 'sky'

export interface AppModule {
  id: string
  icon: LucideIcon
  color: ModuleColor
}

// Fonte única dos módulos — usada no menu do site, na vitrine da landing e no bento grid.
// Título/descrição/bullets ficam em messages/*.json (namespace "Modules", chave = id) para
// suportar os 3 idiomas. Ao lançar um módulo novo, adicione a entrada aqui E em cada messages/*.json.
export const APP_MODULES: AppModule[] = [
  { id: 'perfil-publico', icon: UserCircle, color: 'indigo' },
  { id: 'projetos', icon: FolderHeart, color: 'amber' },
  { id: 'crm-parceiros', icon: Users, color: 'blue' },
  { id: 'financeiro', icon: Wallet, color: 'emerald' },
  { id: 'oracao', icon: HeartHandshake, color: 'rose' },
  { id: 'mensagens', icon: Lock, color: 'violet' },
  { id: 'notificacoes', icon: Bell, color: 'sky' },
]

export const MODULE_COLOR_CLASSES: Record<ModuleColor, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
}
