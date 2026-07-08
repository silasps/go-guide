'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { PaymentMethod } from '@/types/database'
import { getPaymentMethodEntry } from '@/lib/payment-methods/catalog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PaymentMethodForm } from './payment-method-form'
import { toast } from 'sonner'
import { Trash2, Copy } from 'lucide-react'

interface Props {
  method: PaymentMethod
  profileId: string
}

export function PaymentMethodCard({ method, profileId }: Props) {
  const t = useTranslations('PaymentMethods')
  const router = useRouter()
  const { isPending: deleting, run } = usePendingAction()
  const entry = getPaymentMethodEntry(method.type)
  const Icon = entry.icon
  const label = method.label || t(`type_${method.type}`)

  function handleDelete() {
    if (!confirm(t('confirmDelete', { label }))) return
    run(true, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('payment_methods').delete().eq('id', method.id)
      if (error) { toast.error(t('errorDelete')); return }
      toast.success(t('deleted'))
      router.refresh()
    })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(method.value)
    toast.success(t('copied'))
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="font-medium text-sm truncate">{label}</p>
          </div>
          {!method.is_active && <Badge variant="secondary">{t('inactive')}</Badge>}
        </div>
        <button onClick={handleCopy} className="flex w-full items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors">
          <span className="truncate flex-1 font-mono">{method.value}</span>
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
        <div className="flex gap-2 pt-1">
          <PaymentMethodForm profileId={profileId} method={method} />
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
