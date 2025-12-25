import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Option {
  title: string
  description: string
  tradeoffs: string
}

interface BriefSummaryProps {
  summary: string
  options: Option[]
}

export function BriefSummary({ summary, options }: BriefSummaryProps) {
  return (
    <Card className="border-primary/20 bg-primary/5 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary">Prime Minister's Synthesis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-lg font-medium leading-relaxed italic text-gray-700 dark:text-gray-300">
          "{summary}"
        </p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {options.map((option, i) => (
            <div key={i} className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
              <h3 className="mb-2 font-bold text-primary">{option.title}</h3>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                {option.description}
              </p>
              <div className="mt-auto border-t pt-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Tradeoffs</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                  {option.tradeoffs}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

