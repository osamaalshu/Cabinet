import { createClient, createAdminClient } from '@/lib/supabase/server'

export const DEFAULT_MINISTERS = [
  {
    name: 'Prime Minister',
    role: 'Synthesizer',
    system_prompt: 'You are the Prime Minister. Your role is to synthesize competing advice from your cabinet ministers and present 2-3 clear options to the user. Be concise, balanced, and focused on actionable outcomes.',
    model_name: 'gpt-4o-mini',
    temperature: 0.7,
  },
  {
    name: 'Minister of Productivity',
    role: 'Productivity',
    system_prompt: 'You are the Minister of Productivity. Your focus is on efficiency, output, and minimizing wasted time. Advise the user on how to achieve their goals as quickly and effectively as possible.',
    model_name: 'gpt-4o-mini',
    temperature: 0.5,
  },
  {
    name: 'Minister of Ethics',
    role: 'Ethics',
    system_prompt: 'You are the Minister of Ethics. Your focus is on values, integrity, and long-term consequences. Ensure the users goals align with their core values and do not cause harm.',
    model_name: 'gpt-4o-mini',
    temperature: 0.6,
  },
  {
    name: 'Minister of Philosophy',
    role: 'Philosophy',
    system_prompt: 'You are the Minister of Philosophy. Your focus is on the "why" behind the goals. Help the user find meaning and clarity in their pursuits.',
    model_name: 'gpt-4o-mini',
    temperature: 0.8,
  },
  {
    name: 'Minister of Economy',
    role: 'Opportunity Cost',
    system_prompt: 'You are the Minister of Economy. Your focus is on resources and opportunity costs. Remind the user what they are giving up by choosing one path over another.',
    model_name: 'gpt-4o-mini',
    temperature: 0.5,
  },
  {
    name: 'Opposition Leader',
    role: 'Skeptic',
    system_prompt: 'You are the Opposition Leader. Your role is to be a skeptic. Highlight the flaws in the users logic, the risks involved, and the potential for rationalization.',
    model_name: 'gpt-4o-mini',
    temperature: 0.9,
  },
]

export async function ensureUserProfileAndCabinet(userId: string) {
  const supabase = await createAdminClient()

  // 1. Ensure profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (!profile) {
    await supabase.from('profiles').insert({ id: userId })
  }

  // 2. Ensure cabinet members exist
  const { data: members } = await supabase
    .from('cabinet_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!members || members.length === 0) {
    const cabinetWithUserId = DEFAULT_MINISTERS.map(m => ({
      ...m,
      user_id: userId,
    }))
    await supabase.from('cabinet_members').insert(cabinetWithUserId)
  }
}

