'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteBriefAction } from '@/lib/supabase/actions'
import { motion, AnimatePresence } from 'framer-motion'

interface Brief {
  id: string
  title: string
  status: string
  created_at: string
}

export function BriefCard({ brief }: { brief: Brief }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteBriefAction(brief.id)
    } catch (error) {
      console.error('Failed to delete:', error)
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="relative group">
      <Link
        href={`/brief/${brief.id}`}
        className="block p-5 bg-card border border-stone-dark rounded-lg hover:border-wine/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="pr-12">
            <h4 className="heading-serif text-lg text-ink group-hover:text-wine transition-colors">
              {brief.title}
            </h4>
            <p className="body-sans text-sm text-ink-muted mt-1">
              {new Date(brief.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>
          <div className={`px-3 py-1 rounded text-xs uppercase tracking-wider ${
            brief.status === 'done' 
              ? 'bg-approve/10 text-approve' 
              : 'bg-gold/10 text-gold-muted'
          }`}>
            {brief.status === 'done' ? 'Complete' : 'In Progress'}
          </div>
        </div>
      </Link>

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setShowConfirm(true)
        }}
        className="absolute right-16 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 hover:bg-wine/10 rounded transition-all"
        title="Delete session"
      >
        <Trash2 className="h-4 w-4 text-ink-muted hover:text-wine" />
      </button>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => !isDeleting && setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-marble border border-stone-dark rounded-lg p-6 max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="heading-serif text-lg text-ink mb-2">Delete Session?</h3>
              <p className="body-sans text-sm text-ink-muted mb-6">
                This will permanently delete "{brief.title}" and all associated responses. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 body-sans text-sm text-ink hover:bg-stone/50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 body-sans text-sm bg-wine text-white rounded-lg hover:bg-wine-light transition-colors flex items-center gap-2"
                >
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

