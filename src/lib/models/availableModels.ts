export interface ModelOption {
  id: string
  name: string
  provider: 'openai'
  description: string
  inputCost: string
  outputCost: string
  costTier: 'low' | 'medium' | 'high'
  isGpt5?: boolean // GPT-5 models have different API requirements
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // GPT-4 Models (support temperature, use max_tokens)
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
    description: 'Most capable GPT-4 model',
    inputCost: '$2.50/1M',
    outputCost: '$10.00/1M',
    costTier: 'medium',
  },
  // GPT-5 Models (no temperature support, use max_completion_tokens)
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Ultra-fast and cheapest GPT-5 variant',
    inputCost: '$0.05/1M',
    outputCost: '$0.40/1M',
    costTier: 'low',
    isGpt5: true,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Great balance of speed and GPT-5 capability',
    inputCost: '$0.25/1M',
    outputCost: '$2.00/1M',
    costTier: 'low',
    isGpt5: true,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    description: 'Full GPT-5 capabilities',
    inputCost: '$1.25/1M',
    outputCost: '$10.00/1M',
    costTier: 'medium',
    isGpt5: true,
  },
]

export const DEFAULT_MODEL = 'gpt-4o-mini'

// Helper to check if a model is GPT-5 (different API params)
export function isGpt5Model(modelId: string): boolean {
  return modelId.startsWith('gpt-5') || modelId.startsWith('o1') || modelId.startsWith('o3')
}

export function getModelById(id: string): ModelOption | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id)
}

export function getModelsByProvider(provider: 'openai'): ModelOption[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider)
}
