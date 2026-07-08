'use client'

import { useEffect, useState } from 'react'
import * as keyManager from '@/lib/crypto/key-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, Copy, Check, X } from 'lucide-react'

interface Props {
  userId: string
  children: React.ReactNode
}

type State = 'checking' | 'needs_unlock' | 'ready'

export function E2EEGate({ userId, children }: Props) {
  const [state, setState] = useState<State>('checking')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void Promise.resolve().then(async () => {
      if (keyManager.isUnlocked() || keyManager.tryAutoUnlock(userId)) {
        setState('ready')
        return
      }
      const has = await keyManager.hasKeysConfigured(userId)
      if (!has) {
        // Primeiro acesso: gera as chaves automaticamente em segundo plano, sem
        // pedir nada ao usuário — como no WhatsApp, a criptografia é transparente.
        try {
          const { recoveryCode } = await keyManager.setupKeys(userId)
          setRecoveryCode(recoveryCode)
          setShowRecoveryNotice(true)
          setState('ready')
        } catch (err) {
          console.error('setupKeys failed:', err)
          toast.error('Erro ao configurar criptografia.')
        }
        return
      }
      // Já existem chaves no servidor mas não neste navegador (dispositivo novo
      // ou dados locais limpos) — só aqui é preciso pedir o código de recuperação.
      setState('needs_unlock')
    })
  }, [userId])

  async function handleUnlock() {
    setLoading(true)
    try {
      await keyManager.unlockWithRecoveryCode(userId, inputCode.trim())
      setState('ready')
    } catch {
      toast.error('Código de recuperação incorreto.')
    }
    setLoading(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(recoveryCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (state === 'checking') {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  if (state === 'needs_unlock') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Desbloquear conteúdo cifrado</CardTitle>
          <CardDescription>Digite seu código de recuperação para acessar mensagens e orações privadas neste dispositivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={inputCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            className="font-mono"
          />
          <Button className="w-full" onClick={handleUnlock} disabled={loading || !inputCode.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desbloquear
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {showRecoveryNotice && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Suas mensagens agora são cifradas ponta-a-ponta. Guarde este código para acessar de outro dispositivo:
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs bg-muted rounded-lg px-2 py-1.5 flex-1 select-all truncate">{recoveryCode}</p>
                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setShowRecoveryNotice(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}
      {children}
    </div>
  )
}
