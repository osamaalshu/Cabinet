'use client'

import Link from 'next/link'
import { signOutAction } from '@/lib/supabase/actions'

interface NavbarProps {
  userEmail?: string | null
}

export default function Navbar({ userEmail }: NavbarProps) {
  return (
    <nav className="border-b bg-white dark:bg-gray-950">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold">
            Cabinet
          </Link>
          {userEmail && (
            <div className="flex gap-4 text-sm font-medium">
              <Link href="/brief/new" className="hover:text-primary">
                New Brief
              </Link>
              <Link href="/cabinet" className="hover:text-primary">
                The Cabinet
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {userEmail ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{userEmail}</span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium hover:text-primary"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
