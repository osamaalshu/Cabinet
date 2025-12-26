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

export async function runMinister(minister: Minister, context: BriefContext, previousAdvice?: string) {
  const prompt = `
    CONTEXT:
    Goals: ${context.goals}
    Constraints: ${context.constraints}
    Values: ${context.values.join(', ')}

    ${previousAdvice ? `PREVIOUS TESTIMONY FROM OTHER MINISTERS:\n${previousAdvice}\n` : ''}

    Your role: ${minister.name} (${minister.role})
    System Prompt: ${minister.system_prompt}

    Provide your advice for the user based on the context above. ${previousAdvice ? 'Feel free to briefly reference or debate the points made by previous ministers if you disagree or want to add nuance.' : ''}
    
    Format your response as a JSON object with two fields:
    1. "response_text": Your detailed advice (STRICTLY 1 concise paragraph).
    2. "vote": Your recommendation. Choose one: "approve", "abstain", or "oppose".
    3. "justification": A 1-sentence justification for your vote.
  `

  try {
    const response = await openai.chat.completions.create({
      model: minister.model_name || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: minister.system_prompt },
        { role: 'user', content: prompt },
      ],
      temperature: minister.temperature || 0.7,
      response_format: { type: 'json_object' },
    }, { timeout: 7000 })

    const content = response.choices[0].message.content
    if (!content) throw new Error('No content returned from OpenAI')

    return JSON.parse(content)
  } catch (error: any) {
    console.error(`Error running minister ${minister.name}:`, error.message)
    return {
      response_text: `Error: ${error.message}`,
      vote: 'abstain',
      justification: 'Failed to connect to AI service.'
    }
  }
}

export async function runPrimeMinister(
  pmMinister: Minister,
  context: BriefContext,
  ministerResponses: any[]
) {
  const ministerAdvice = ministerResponses
    .map(r => `${r.name || r.member?.name} (${r.role || r.member?.role}): ${r.response_text} (Vote: ${r.vote})`)
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
    Be extremely concise and fast.
    Format your response as a JSON object with:
    1. "summary": A brief synthesis (max 2 sentences).
    2. "options": An array of objects, each with "title", "description" (1 sentence), and "tradeoffs" (1 sentence).
  `

  const response = await openai.chat.completions.create({
    model: pmMinister.model_name || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: pmMinister.system_prompt },
      { role: 'user', content: prompt },
    ],
    temperature: pmMinister.temperature || 0.7,
    response_format: { type: 'json_object' },
  }, { timeout: 7000 })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No content returned from OpenAI')

  return JSON.parse(content)
}
