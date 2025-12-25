'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type SeatState = 'idle' | 'speaking' | 'responded'
export type VoteType = 'yay' | 'nay' | 'abstain' | 'approve' | 'oppose' | null

interface SeatProps {
  name: string
  role: string
  state: SeatState
  vote?: VoteType
  response?: string
  isOpposition?: boolean
  onClick?: () => void
}

export function Seat({ name, role, state, vote, response, isOpposition, onClick }: SeatProps) {
  const isActive = state === 'speaking'
  const hasResponse = state === 'responded' && response
  
  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-300',
        'bg-marble hover:shadow-lg',
        isActive && 'border-wine shadow-xl ring-2 ring-wine/20',
        hasResponse && !isActive && 'border-stone-dark',
        !hasResponse && !isActive && 'border-stone',
        isOpposition && 'border-l-4 border-l-wine-dark'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Speaking indicator */}
      {isActive && (
        <motion.div
          className="absolute -top-1 -right-1 bg-wine text-marble text-xs px-2 py-0.5 rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          Speaking...
        </motion.div>
      )}

      {/* Header */}
      <div className="mb-2">
        <h3 className="heading-serif text-sm text-ink truncate">{name}</h3>
        <p className="text-[10px] uppercase tracking-widest text-ink-muted">{role}</p>
      </div>

      {/* Content */}
      {hasResponse ? (
        <div className="space-y-2">
          <p className="body-sans text-xs text-ink-muted line-clamp-4">
            {response}
          </p>
          
          {vote && (
            <div className={cn(
              'inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
              (vote === 'yay' || vote === 'approve') && 'bg-green-100 text-green-800',
              (vote === 'nay' || vote === 'oppose') && 'bg-wine/10 text-wine',
              vote === 'abstain' && 'bg-stone text-ink-muted'
            )}>
              {vote === 'yay' ? 'approve' : vote === 'nay' ? 'oppose' : vote}
            </div>
          )}
        </div>
      ) : (
        <div className="h-12 flex items-center justify-center">
          {isActive ? (
            <motion.div
              className="flex gap-1"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="w-1.5 h-1.5 bg-wine rounded-full" />
              <span className="w-1.5 h-1.5 bg-wine rounded-full" />
              <span className="w-1.5 h-1.5 bg-wine rounded-full" />
            </motion.div>
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-stone bg-marble-warm" />
          )}
        </div>
      )}
    </motion.div>
  )
}
