'use client'

import { motion } from 'framer-motion'

const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

interface RevealProps {
  children: React.ReactNode
  className?: string
  /** Seções perto do topo revelam no mount (padrão, primeira impressão
   *  imediata). Seções mais abaixo — a página ficou mais longa com
   *  galeria/timeline — usam `onScroll` pra revelar ao entrar na viewport,
   *  dando a sensação "viva" conforme o parceiro rola a página. */
  onScroll?: boolean
}

// Wrapper genérico de entrada com stagger — mesmo padrão de FinancialDashboard
// (src/components/financial/financial-dashboard.tsx). A página que usa isso
// (atualizacoes/[broadcastId]/page.tsx) continua Server Component; só esta
// casca vira client, os filhos (server-renderizados) passam por `children`.
export function Reveal({ children, className, onScroll }: RevealProps) {
  // `amount: 0` (qualquer pixel visível conta) em vez de `margin: '-40px'`
  // (bug real: um `margin` negativo encolhe a zona de detecção, então uma
  // seção que já nasce quase visível — comum em relatórios curtos, sem
  // timeline/projetos — nunca cruza a zona encolhida e fica presa em
  // `opacity: 0` pra sempre, com `once: true`, se o visitante tiver tela
  // alta o bastante pra nunca precisar rolar). Verificado com Playwright:
  // sem o `margin`, a seção revela já no carregamento quando já está
  // visível, e ao rolar quando não está.
  return onScroll ? (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0 }} transition={{ staggerChildren: 0.08 }}>
      {children}
    </motion.div>
  ) : (
    <motion.div className={className} initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
