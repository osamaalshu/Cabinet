'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/lib/supabase/actions'
import { User, LogOut, Settings, Home, Plus, Users, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface NavbarProps {
  userEmail?: string | null
  userName?: string | null
}

export function Navbar({ userEmail, userName }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = userName || userEmail?.split('@')[0] || 'User'

  const isActive = (path: string) => pathname === path

  return (
    <>
      {/* Top Navbar */}
      <nav className="border-b border-stone bg-marble/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-6">
          {/* Left - Logo */}
          <Link href="/" className="heading-serif text-xl text-ink hover:text-wine transition-colors">
            Cabinet
          </Link>

          {/* Center - Navigation (desktop) */}
          {userEmail && (
            <div className="hidden md:flex items-center gap-1">
              <Link 
                href="/" 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg body-sans text-sm transition-all ${
                  isActive('/') ? 'text-wine bg-wine/5' : 'text-ink-muted hover:text-ink hover:bg-stone/50'
                }`}
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
              <Link 
                href="/brief/new" 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg body-sans text-sm transition-all ${
                  isActive('/brief/new') ? 'text-wine bg-wine/5' : 'text-ink-muted hover:text-ink hover:bg-stone/50'
                }`}
              >
                <Plus className="h-4 w-4" />
                New Session
              </Link>
              <Link 
                href="/cabinet" 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg body-sans text-sm transition-all ${
                  isActive('/cabinet') ? 'text-wine bg-wine/5' : 'text-ink-muted hover:text-ink hover:bg-stone/50'
                }`}
              >
                <Users className="h-4 w-4" />
                Configure
              </Link>
            </div>
          )}

          {/* Right - Account Menu */}
          <div className="flex items-center gap-4">
            {userEmail ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone/50 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-wine/10 border border-wine/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-wine" />
                  </div>
                  <span className="hidden sm:block body-sans text-sm text-ink max-w-32 truncate">
                    {displayName}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-ink-muted transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-marble border border-stone-dark rounded-lg shadow-lg overflow-hidden"
                    >
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-stone bg-stone/30">
                        <p className="heading-serif text-sm text-ink">{displayName}</p>
                        <p className="body-sans text-xs text-ink-muted truncate">{userEmail}</p>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <Link
                          href="/account"
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 body-sans text-sm text-ink hover:bg-stone/50 transition-colors"
                        >
                          <Settings className="h-4 w-4 text-ink-muted" />
                          Account Settings
                        </Link>
                      </div>

                      {/* Sign Out */}
                      <div className="py-2 border-t border-stone">
                        <form action={signOutAction}>
                          <button
                            type="submit"
                            className="flex items-center gap-3 w-full px-4 py-2 body-sans text-sm text-wine hover:bg-wine/5 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-wine text-white rounded-lg body-sans text-sm hover:bg-wine-light transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      {userEmail && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-marble/95 backdrop-blur-sm border-t border-stone">
          <div className="flex justify-around items-center h-16 px-4">
            <Link 
              href="/" 
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                isActive('/') ? 'text-wine' : 'text-ink-muted'
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs body-sans">Home</span>
            </Link>
            <Link 
              href="/brief/new" 
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                isActive('/brief/new') ? 'text-wine' : 'text-ink-muted'
              }`}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs body-sans">New</span>
            </Link>
            <Link 
              href="/cabinet" 
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                isActive('/cabinet') ? 'text-wine' : 'text-ink-muted'
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs body-sans">Cabinet</span>
            </Link>
            <Link 
              href="/account" 
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                isActive('/account') ? 'text-wine' : 'text-ink-muted'
              }`}
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs body-sans">Account</span>
            </Link>
          </div>
        </nav>
      )}
    </>
  )
}

export default Navbar
