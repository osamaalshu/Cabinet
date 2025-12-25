'use client'

import { motion } from 'framer-motion'

interface PlanOption {
  title: string
  description: string
  tradeoffs: string
}

interface PodiumProps {
  summary: string
  options: PlanOption[]
  onSelectOption?: (index: number) => void
}

export function Podium({ summary, options, onSelectOption }: PodiumProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="podium relative"
    >
      {/* Decorative Top Border */}
      <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      
      <div className="bg-card border border-stone-dark rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-stone bg-marble-warm/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-8 bg-gold rounded-full" />
            <h2 className="heading-display text-2xl text-ink">
              The Prime Minister's Synthesis
            </h2>
          </div>
          <p className="body-sans text-ink-light leading-relaxed text-lg pl-4 border-l-2 border-stone italic">
            "{summary}"
          </p>
        </div>

        {/* Options */}
        <div className="p-6">
          <p className="body-sans text-xs uppercase tracking-widest text-ink-muted mb-4">
            Presented Options
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {options.map((option, i) => (
              <motion.button
                key={i}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectOption?.(i)}
                className="group text-left p-5 rounded-lg border border-stone-dark bg-marble-warm/30 hover:border-wine/50 hover:bg-wine/5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="heading-serif text-lg text-ink group-hover:text-wine transition-colors">
                    {option.title}
                  </span>
                  <span className="text-xs text-ink-muted font-medium">
                    {String.fromCharCode(65 + i)}
                  </span>
                </div>
                <p className="body-sans text-sm text-ink-light leading-relaxed mb-4">
                  {option.description}
                </p>
                <div className="pt-3 border-t border-stone">
                  <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                    Tradeoffs
                  </p>
                  <p className="body-sans text-xs text-ink-muted italic">
                    {option.tradeoffs}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Decorative Bottom Border */}
      <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
    </motion.div>
  )
}

