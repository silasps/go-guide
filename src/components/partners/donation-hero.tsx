'use client'

import Image from 'next/image'

interface Props {
  imageUrl: string | null
  alt: string
}

// Foto de contexto no topo do formulário — capa do projeto quando a doação
// está vinculada a um, foto de perfil do missionário no caso geral (decidido
// por quem monta o formulário, ver partnership-wizard.tsx). Puxado do mockup
// do Stitch, sem o texto/citação (não temos esse dado hoje).
export function DonationHero({ imageUrl, alt }: Props) {
  if (!imageUrl) return null
  return (
    <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border">
      <Image src={imageUrl} alt={alt} fill className="object-cover" />
    </div>
  )
}
