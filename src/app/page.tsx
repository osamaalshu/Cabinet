import Link from 'next/link'
import Navbar from '@/components/common/Navbar'
import { requireUser } from '@/lib/supabase/auth'
import { Button } from '@/components/ui/button'
import { PlusCircle, History } from 'lucide-react'

export default async function DashboardPage() {
  const user = await requireUser()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar userEmail={user.email} />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-gray-500">Welcome back to your Cabinet.</p>
          </div>
          <Button asChild>
            <Link href="/brief/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Start Morning Brief
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                <History className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">Recent Briefs</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              You haven't called a cabinet meeting yet.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/brief/new">Create your first brief</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
