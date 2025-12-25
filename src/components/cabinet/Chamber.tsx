'use client'

import { motion } from 'framer-motion'
import { Navbar } from '@/components/common/Navbar'

interface ChamberProps {
  title: string
  subtitle?: string
  isInSession?: boolean
  userEmail?: string | null
  userName?: string | null
  children: React.ReactNode
}

export function Chamber({ title, subtitle, isInSession, userEmail, userName, children }: ChamberProps) {
  return (
    <div className="min-h-screen bg-marble">
      <Navbar userEmail={userEmail} userName={userName} />
      
      {/* Chamber Header */}
      <header className="pt-12 pb-8 text-center">
        <motion.h1 
          className="heading-display text-4xl md:text-5xl text-ink"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p 
            className="mt-2 body-sans text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {subtitle}
          </motion.p>
        )}
        
        {/* Session indicator */}
        {isInSession && (
          <motion.div 
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-wine/10 rounded-full"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="w-2 h-2 bg-wine rounded-full" />
            <span className="text-sm text-wine font-medium">Live Session</span>
          </motion.div>
        )}
      </header>

      {/* Chamber Content */}
      <main className="px-4 pb-20 overflow-x-auto">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Decorative footer accent */}
      <div className="fixed bottom-0 inset-x-0 h-2 bg-gradient-to-r from-wine via-wine-dark to-wine" />
    </div>
  )
}
