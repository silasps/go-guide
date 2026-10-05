'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  src: string
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
}

// Visualizador de comprovante de lançamento: imagem ampliada num card de
// modal, com botão de baixar. O download é feito pelo blob (fetch → URL
// local → link com `download`) porque o link direto do bucket é de outra
// origem e o atributo `download` seria ignorado; se o fetch falhar, abre a
// imagem numa aba nova como alternativa.
export function ProofViewer({ src, open, onOpenChange, fileName }: Props) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.open(src, '_blank', 'noopener')
      toast.info('Não foi possível baixar direto — a imagem abriu numa nova aba.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl gap-3 p-4 sm:max-w-3xl">
        <DialogTitle className="text-sm font-semibold">Comprovante</DialogTitle>

        <div className="flex max-h-[70dvh] items-center justify-center overflow-auto rounded-lg bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- dimensão real do comprovante não é conhecida de antemão; o navegador dimensiona pelo arquivo, limitado por max-h/max-w. */}
          <img src={src} alt="Comprovante do lançamento" className="block h-auto max-h-[70dvh] w-auto max-w-full object-contain" />
        </div>

        <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-xl" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Baixar comprovante
        </Button>
      </DialogContent>
    </Dialog>
  )
}
