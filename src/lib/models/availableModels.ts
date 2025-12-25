export interface ModelOption {
  id: string
  name: string
  provider: 'openai' | 'anthropic'
  description: string
  maxTokens: number
  costTier: 'low' | 'medium' | 'high'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI Models
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and affordable, great for most tasks',
    maxTokens: 16384,
    costTier: 'low',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable OpenAI model',
    maxTokens: 16384,
    costTier: 'high',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'High capability with vision support',
    maxTokens: 4096,
    costTier: 'high',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Legacy model, very fast',
    maxTokens: 4096,
    costTier: 'low',
  },
]

export const DEFAULT_MODEL = 'gpt-4o-mini'

export function getModelById(id: string): ModelOption | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id)
}

export function getModelsByProvider(provider: 'openai' | 'anthropic'): ModelOption[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider)
}

