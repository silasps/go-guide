'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { PaymentMethod, PaymentMethodType } from '@/types/database'
import { MANUAL_PAYMENT_METHOD_CATALOG, PAYMENT_METHOD_GROUPS, getPaymentMethodEntry } from '@/lib/payment-methods/catalog'
import { formatBankDetails, parseBankDetails } from '@/lib/payment-methods/bank-details'
import { CURRENCIES } from '@/lib/currency-mask'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

const GROUPS_IN_FORM = PAYMENT_METHOD_GROUPS.filter(g => g !== 'automatic')

interface Props {
  profileId: string
  method?: PaymentMethod
  nextSortOrder?: number
}

export function PaymentMethodForm({ profileId, method, nextSortOrder = 0 }: Props) {
  const t = useTranslations('PaymentMethods')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { isPending: saving, run } = usePendingAction()
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? 'pix')
  const [currency, setCurrency] = useState(method?.currency ?? 'BRL')
  const [label, setLabel] = useState(method?.label ?? '')
  const [value, setValue] = useState(method?.value ?? '')
  const [details, setDetails] = useState(method?.details ?? '')
  const [bankFields, setBankFields] = useState(() => parseBankDetails(method?.details ?? null))
  const [isActive, setIsActive] = useState(method?.is_active ?? true)
  const entry = getPaymentMethodEntry(type)
  const isOther = type === 'other'
  const isBank = type === 'bank_transfer'

  function resetForm() {
    setType('pix')
    setCurrency('BRL')
    setLabel('')
    setValue('')
    setDetails('')
    setBankFields(parseBankDetails(null))
    setIsActive(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen && !method) resetForm()
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!value.trim()) { toast.error(t('errorValueRequired')); return }
    if ((isOther || isBank) && !label.trim()) { toast.error(t('errorLabelRequired')); return }

    run(true, async () => {
      const supabase = createClient()
      const payload = {
        type,
        currency,
        label: label.trim() || null,
        value: value.trim(),
        details: isBank ? (formatBankDetails(bankFields) || null) : entry.hasDetails ? (details.trim() || null) : null,
        is_active: isActive,
      }

      if (method) {
        const { error } = await supabase.from('payment_methods').update(payload).eq('id', method.id)
        if (error) { toast.error(t('errorSave')); return }
        toast.success(t('updated'))
      } else {
        const { error } = await supabase.from('payment_methods').insert({
          profile_id: profileId,
          sort_order: nextSortOrder,
          ...payload,
        })
        if (error) { toast.error(t('errorSave')); return }
        toast.success(t('created'))
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={
        <Button variant={method ? 'outline' : 'default'} size={method ? 'sm' : 'default'} className="gap-2">
          {!method && <Plus className="h-4 w-4" />}
          {method ? t('edit') : t('newMethod')}
        </Button>
      } />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{method ? t('editTitle') : t('newTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('typeLabel')}</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PaymentMethodType)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              {GROUPS_IN_FORM.map(group => (
                <optgroup key={group} label={t(`group_${group}`)}>
                  {MANUAL_PAYMENT_METHOD_CATALOG.filter(e => e.group === group).map(e => (
                    <option key={e.type} value={e.type}>{t(`type_${e.type}`)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('currencyLabel')}</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{isBank ? t('bankHolderLabel') : t('labelLabel')}{(isOther || isBank) && ' *'}</Label>
            <Input
              value={label}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
              placeholder={isBank ? t('bankHolderPlaceholder') : isOther ? t('labelPlaceholderOther') : t(`type_${type}`)}
              required={isOther || isBank}
            />
          </div>
          <div className="space-y-2">
            <Label>{isBank ? t('bankAccountLabel') : t('valueLabel')} *</Label>
            <Input
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
              placeholder={t(`placeholder_${type}`)}
              required
            />
          </div>
          {isBank ? (
            <div className="space-y-3 rounded-lg border border-input p-3">
              <div className="space-y-2">
                <Label>{t('bankNameLabel')}</Label>
                <Input value={bankFields.bankName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankFields({ ...bankFields, bankName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('bankSwiftLabel')}</Label>
                  <Input value={bankFields.swift} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankFields({ ...bankFields, swift: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('bankRoutingLabel')}</Label>
                  <Input value={bankFields.routingNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankFields({ ...bankFields, routingNumber: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('bankAddressLabel')}</Label>
                <Input value={bankFields.bankAddress} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankFields({ ...bankFields, bankAddress: e.target.value })} />
              </div>
            </div>
          ) : entry.hasDetails && (
            <div className="space-y-2">
              <Label>{t('detailsLabel')}</Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                placeholder={t('detailsPlaceholder')}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
            {t('activeLabel')}
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {method ? t('save') : t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
