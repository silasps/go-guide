import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HandHeart, Heart } from 'lucide-react'

export function ProfileCTA({ username }: { username: string }) {
  return (
    <div className="space-y-2">
      {/* Ações principais */}
      <div className="flex gap-3">
        <Link href={`/${username}/parceria`} className={cn(buttonVariants(), 'flex-1 gap-2')}>
          <HandHeart className="h-4 w-4" />
          Seja Parceiro
        </Link>
        <Link href={`/${username}/oracao`} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1 gap-2')}>
          <Heart className="h-4 w-4" />
          Enviar Oração
        </Link>
      </div>

      {/* Links de navegação secundários */}
      <div className="flex gap-2">
        <Link href={`/${username}/projetos`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1 text-muted-foreground text-xs')}>
          Ver todos os projetos
        </Link>
        <Link href={`/${username}/historia`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1 text-muted-foreground text-xs')}>
          Nossa história
        </Link>
      </div>
    </div>
  )
}
