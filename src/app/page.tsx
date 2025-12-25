import Link from 'next/link'
import { requireUser } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Plus } from 'lucide-react'
import { Navbar } from '@/components/common/Navbar'
import { BriefCard } from '@/components/dashboard/BriefCard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()
  
  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-marble">
      <Navbar userEmail={user.email} userName={profile?.display_name} />

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h2 className="heading-display text-5xl md:text-6xl text-ink mb-4">
            Convene Your Council
          </h2>
          <p className="body-sans text-lg text-ink-muted max-w-xl mx-auto">
            Present your goals to the Cabinet. Your advisors will deliberate and offer guidance.
          </p>
        </div>

        {/* CTA */}
        <div className="flex justify-center mb-20">
          <Link
            href="/brief/new"
            className="group inline-flex items-center gap-3 px-8 py-4 bg-wine text-white rounded-lg heading-serif text-xl hover:bg-wine-light transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Begin New Session</span>
            <ArrowRight className="h-5 w-5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
          </Link>
        </div>

        {/* All Sessions */}
        {briefs && briefs.length > 0 && (
          <div>
            <h3 className="heading-serif text-lg text-ink mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-stone-dark" />
              Your Sessions
            </h3>
            <div className="space-y-3">
              {briefs.map((brief) => (
                <BriefCard key={brief.id} brief={brief} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!briefs || briefs.length === 0) && (
          <div className="text-center py-16 border border-dashed border-stone-dark rounded-lg">
            <p className="body-sans text-ink-muted">
              No sessions yet. Begin your first deliberation above.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
