'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type SeatState = 'idle' | 'speaking' | 'responded'
export type VoteType = 'approve' | 'abstain' | 'oppose'

interface SeatProps {
  name: string
  role: string
  state: SeatState
  vote?: VoteType
  response?: string
  isOpposition?: boolean
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

const voteStyles: Record<VoteType, string> = {
  approve: 'text-approve border-approve/30 bg-approve/5',
  oppose: 'text-oppose border-oppose/30 bg-oppose/5',
  abstain: 'text-abstain border-abstain/30 bg-abstain/5',
}

const voteLabels: Record<VoteType, string> = {
  approve: 'Aye',
  oppose: 'Nay',
  abstain: 'Abstains',
}

export function Seat({ 
  name, 
  role, 
  state, 
  vote, 
  response, 
  isOpposition,
  className,
  style,
  onClick 
}: SeatProps) {
  const hasResponse = state === 'responded' && response

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      style={style}
      className={cn(
        'seat relative cursor-pointer',
        'rounded-lg border bg-card p-5',
        'transition-all duration-500',
        state === 'speaking' && 'seat--speaking animate-speak border-wine',
        state === 'idle' && 'seat--idle border-stone-dark',
        state === 'responded' && 'border-stone-dark hover:border-wine/50',
        isOpposition && 'border-l-4 border-l-oppose',
        className
      )}
    >
      {/* Speaking Indicator */}
      {state === 'speaking' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-wine text-white text-xs font-medium rounded-full"
        >
          Speaking...
        </motion.div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h3 className="heading-serif text-lg text-ink leading-tight">{name}</h3>
        <p className="body-sans text-xs text-ink-muted uppercase tracking-widest mt-0.5">
          {role}
        </p>
      </div>

      {/* Content */}
      {state === 'speaking' && (
        <div className="flex items-center justify-center py-6">
          <div className="flex gap-1">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 rounded-full bg-wine"
            />
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 rounded-full bg-wine"
            />
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 rounded-full bg-wine"
            />
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex items-center justify-center py-6">
          <div className="w-10 h-10 rounded-full bg-stone border-2 border-stone-dark" />
        </div>
      )}

      {hasResponse && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="body-sans text-sm text-ink-light leading-relaxed line-clamp-4">
            {response}
          </p>
          
          {vote && (
            <div className={cn(
              'mt-4 inline-flex items-center px-3 py-1.5 rounded border text-xs font-medium uppercase tracking-wider',
              voteStyles[vote]
            )}>
              {voteLabels[vote]}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

