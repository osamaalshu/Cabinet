import Link from 'next/link'
import { requireUser } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()
  
  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="min-h-screen bg-marble">
      {/* Header */}
      <header className="border-b border-stone bg-marble/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="heading-serif text-xl text-ink">Cabinet</h1>
          <div className="flex items-center gap-4">
            <span className="body-sans text-sm text-ink-muted">{user.email}</span>
            <Link 
              href="/cabinet" 
              className="body-sans text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Configure
            </Link>
          </div>
        </div>
      </header>

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

        {/* Recent Sessions */}
        {briefs && briefs.length > 0 && (
          <div>
            <h3 className="heading-serif text-lg text-ink mb-6 flex items-center gap-3">
              <span className="w-8 h-px bg-stone-dark" />
              Recent Sessions
            </h3>
            <div className="space-y-3">
              {briefs.map((brief) => (
                <Link
                  key={brief.id}
                  href={`/brief/${brief.id}`}
                  className="block p-5 bg-card border border-stone-dark rounded-lg hover:border-wine/30 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
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
