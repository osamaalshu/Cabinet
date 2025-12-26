export interface ModelOption {
  id: string
  name: string
  provider: 'openai'
  description: string
  inputCost: string
  outputCost: string
  costTier: 'low' | 'medium' | 'high'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective, great for most tasks',
    inputCost: '$0.15/1M',
    outputCost: '$0.60/1M',
    costTier: 'low',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable model, best for complex reasoning',
    inputCost: '$2.50/1M',
    outputCost: '$10.00/1M',
    costTier: 'medium',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Powerful with large context window',
    inputCost: '$10.00/1M',
    outputCost: '$30.00/1M',
    costTier: 'high',
  },
]

export const DEFAULT_MODEL = 'gpt-4o-mini'

export function getModelById(id: string): ModelOption | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id)
}

export function getModelsByProvider(provider: 'openai'): ModelOption[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider)
}
