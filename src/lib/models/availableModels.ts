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
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Ultra-fast and cheapest, perfect for quick tasks',
    inputCost: '$0.05/1M',
    outputCost: '$0.40/1M',
    costTier: 'low',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Great balance of speed and capability',
    inputCost: '$0.25/1M',
    outputCost: '$2.00/1M',
    costTier: 'low',
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    description: 'Full GPT-5 capabilities at reasonable cost',
    inputCost: '$1.25/1M',
    outputCost: '$10.00/1M',
    costTier: 'medium',
  },
]

export const DEFAULT_MODEL = 'gpt-5-nano'

export function getModelById(id: string): ModelOption | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id)
}

export function getModelsByProvider(provider: 'openai'): ModelOption[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider)
}
