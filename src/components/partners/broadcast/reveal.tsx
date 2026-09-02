'use client'

import { motion } from 'framer-motion'

const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

// Wrapper genérico de entrada com stagger — mesmo padrão de FinancialDashboard
// (src/components/financial/financial-dashboard.tsx). A página que usa isso
// (atualizacoes/[broadcastId]/page.tsx) continua Server Component; só esta
// casca vira client, os filhos (server-renderizados) passam por `children`.
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
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
