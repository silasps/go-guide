'use client'

import { useEffect, useState } from 'react'
import * as keyManager from '@/lib/crypto/key-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, Copy, Check } from 'lucide-react'

interface Props {
  userId: string
  children: React.ReactNode
}

type State = 'checking' | 'needs_setup' | 'showing_recovery_code' | 'needs_unlock' | 'unlocked'

export function E2EEGate({ userId, children }: Props) {
  const [state, setState] = useState<State>('checking')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void Promise.resolve().then(async () => {
      if (keyManager.isUnlocked()) { setState('unlocked'); return }
      const has = await keyManager.hasKeysConfigured(userId)
      setState(has ? 'needs_unlock' : 'needs_setup')
    })
  }, [userId])

  async function handleSetup() {
    setLoading(true)
    try {
      const { recoveryCode } = await keyManager.setupKeys(userId)
      setRecoveryCode(recoveryCode)
      setState('showing_recovery_code')
    } catch (err) {
      console.error('setupKeys failed:', err)
      toast.error('Erro ao configurar criptografia.')
    }
    setLoading(false)
  }

  async function handleUnlock() {
    setLoading(true)
    try {
      await keyManager.unlockWithRecoveryCode(userId, inputCode.trim())
      setState('unlocked')
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

  if (state === 'needs_setup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Ativar criptografia ponta-a-ponta</CardTitle>
          <CardDescription>
            Mensagens e pedidos de oração privados são cifrados de forma que nem o go_guide consegue ler o conteúdo — só você e as pessoas autorizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSetup} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Configurar agora
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (state === 'showing_recovery_code') {
    return (
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="text-base">Guarde seu código de recuperação</CardTitle>
          <CardDescription>
            Este código é a única forma de acessar suas mensagens cifradas em um novo dispositivo ou navegador.
            <strong className="text-foreground"> Ninguém mais tem acesso a ele — nem nós.</strong> Se você perder, o conteúdo cifrado não pode ser recuperado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm bg-muted rounded-lg px-3 py-2 flex-1 select-all">{recoveryCode}</p>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="rounded border-input" />
            Eu salvei este código em um lugar seguro
          </label>
          <Button className="w-full" disabled={!confirmed} onClick={() => setState('unlocked')}>
            Continuar
          </Button>
        </CardContent>
      </Card>
    )
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

  return <>{children}</>
}
