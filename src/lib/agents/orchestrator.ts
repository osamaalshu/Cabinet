import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface Minister {
  id: string
  name: string
  role: string
  system_prompt: string
  model_name: string
  temperature: number
}

export interface BriefContext {
  goals: string
  constraints: string
  values: string[]
}

export async function runMinister(minister: Minister, context: BriefContext) {
  const prompt = `
    CONTEXT:
    Goals: ${context.goals}
    Constraints: ${context.constraints}
    Values: ${context.values.join(', ')}

    Your role: ${minister.name} (${minister.role})
    System Prompt: ${minister.system_prompt}

    Provide your advice for the user based on the context above.
    Format your response as a JSON object with two fields:
    1. "response_text": Your detailed advice (2-3 paragraphs).
    2. "vote": Your recommendation. Choose one: "approve", "abstain", or "oppose".
    3. "justification": A 1-sentence justification for your vote.
  `

  const response = await openai.chat.completions.create({
    model: minister.model_name,
    messages: [
      { role: 'system', content: minister.system_prompt },
      { role: 'user', content: prompt },
    ],
    temperature: minister.temperature,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No content returned from OpenAI')

  return JSON.parse(content)
}

export async function runPrimeMinister(
  pmMinister: Minister,
  context: BriefContext,
  ministerResponses: any[]
) {
  const ministerAdvice = ministerResponses
    .map(r => `${r.name} (${r.role}): ${r.response_text} (Vote: ${r.vote})`)
    .join('\n\n')

  const prompt = `
    CONTEXT:
    Goals: ${context.goals}
    Constraints: ${context.constraints}
    Values: ${context.values.join(', ')}

    CABINET ADVICE:
    ${ministerAdvice}

    Your role: ${pmMinister.name} (${pmMinister.role})
    
    Synthesize the competing advice and present 2-3 plan options to the user.
    Format your response as a JSON object with:
    1. "summary": A brief synthesis of the cabinet's sentiment.
    2. "options": An array of objects, each with "title", "description", and "tradeoffs".
  `

  const response = await openai.chat.completions.create({
    model: pmMinister.model_name,
    messages: [
      { role: 'system', content: pmMinister.system_prompt },
      { role: 'user', content: prompt },
    ],
    temperature: pmMinister.temperature,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No content returned from OpenAI')

  return JSON.parse(content)
}

