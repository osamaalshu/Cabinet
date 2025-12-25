import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface MinisterCardProps {
  name: string
  role: string
  responseText: string
  vote: 'approve' | 'abstain' | 'oppose'
  onClick: () => void
}

export function MinisterCard({ name, role, responseText, vote, onClick }: MinisterCardProps) {
  const VoteIcon = {
    approve: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    oppose: <XCircle className="h-5 w-5 text-red-500" />,
    abstain: <AlertCircle className="h-5 w-5 text-yellow-500" />,
  }[vote]

  return (
    <Card 
      className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/50"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">{name}</CardTitle>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{role}</p>
        </div>
        {VoteIcon}
      </CardHeader>
      <CardContent>
        <p className="line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
          {responseText}
        </p>
        <div className="mt-4">
          <Badge variant={vote === 'approve' ? 'default' : vote === 'oppose' ? 'destructive' : 'outline'}>
            {vote.toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

