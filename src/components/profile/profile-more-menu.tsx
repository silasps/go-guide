'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { MoreHorizontal, Share2, Link2, Flag } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { LanguageSwitcher } from '@/components/marketing/language-switcher'
import { ReportDialog } from '@/components/shared/report-dialog'

interface Props {
  profileId: string
  username: string
  displayName: string
  canEdit: boolean
}

// Menu "..." do perfil público, estilo Instagram — substitui o seletor de
// idioma solto ("PT ▾") da barra de abas e consolida nele as ações de
// compartilhar/denunciar que antes ficavam soltas no rodapé do ProfileCTA
// (a pedido do usuário). "Denunciar" só existe para quem não é dono do
// perfil — não faz sentido denunciar a própria conta.
export function ProfileMoreMenu({ profileId, username, displayName, canEdit }: Props) {
  const t = useTranslations('PublicProfile')
  const tReport = useTranslations('Report')
  const [reportOpen, setReportOpen] = useState(false)
  const [generatingShortLink, setGeneratingShortLink] = useState(false)

  async function handleShare() {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/${username}`
    if (navigator.share) {
      try {
        await navigator.share({ title: displayName, url })
      } catch {
        // usuário cancelou — não é erro
      }
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success(t('linkCopied'))
  }

  // Link curto (ver migration 070) pensado pra bio do Instagram/redes,
  // onde o link precisa ser curto — diferente de "compartilhar" acima,
  // que usa o link canônico completo. Passa pela API route (não mutação
  // direta do client) porque o backend tenta embrulhar num encurtador
  // externo antes de devolver (migration 072).
  async function handleCopyShortLink() {
    if (generatingShortLink) return
    setGeneratingShortLink(true)
    try {
      const res = await fetch('/api/short-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, targetType: 'profile' }),
      })
      if (!res.ok) throw new Error('failed to create short link')
      const { url } = await res.json()
      await navigator.clipboard.writeText(url)
      toast.success(t('shortLinkCopied'))
    } catch {
      toast.error(t('shortLinkError'))
    } finally {
      setGeneratingShortLink(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('moreOptions')}
          className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            {t('shareProfile')}
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={handleCopyShortLink} disabled={generatingShortLink} className="gap-2">
              <Link2 className="h-4 w-4" />
              {t('copyShortLink')}
            </DropdownMenuItem>
          )}
          <LanguageSwitcher submenu />
          {!canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setReportOpen(true)} className="gap-2">
                <Flag className="h-4 w-4" />
                {tReport('reportProfile')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!canEdit && (
        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="profile" targetId={profileId} />
      )}
    </>
  )
}
