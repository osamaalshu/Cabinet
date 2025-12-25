'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface ChamberProps {
  title: string
  subtitle?: string
  isInSession?: boolean
  children: ReactNode
}

export function Chamber({ title, subtitle, isInSession, children }: ChamberProps) {
  return (
    <div className="chamber min-h-screen bg-marble">
      {/* Ambient Floor Gradient */}
      <div className="chamber-floor" />
      
      {/* Header */}
      <header className="relative z-10 w-full border-b border-stone bg-marble/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="heading-serif text-xl text-ink hover:text-wine transition-colors">
            Cabinet
          </Link>
          <nav className="flex items-center gap-6">
            <Link 
              href="/brief/new" 
              className="body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              New Session
            </Link>
            <Link 
              href="/cabinet" 
              className="body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Configure
            </Link>
          </nav>
        </div>
      </header>

      {/* Title */}
      <div className="relative z-10 text-center pt-12 pb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="heading-display text-4xl md:text-5xl text-ink mb-2"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="body-sans text-ink-muted"
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        {children}
      </main>

      {/* Session Indicator */}
      {isInSession && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 inset-x-0 z-20"
        >
          <div className="bg-wine/95 backdrop-blur text-white py-3 px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              <span className="body-sans text-sm font-medium">
                Deliberation in Progress
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

