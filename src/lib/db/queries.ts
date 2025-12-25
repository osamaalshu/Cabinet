import { createClient, createAdminClient } from '@/lib/supabase/server'

export const DEFAULT_MINISTERS = [
  {
    name: 'Prime Minister',
    role: 'Synthesizer',
    system_prompt: 'You are the Prime Minister. Your role is to synthesize competing advice from your cabinet ministers and present 2-3 clear options to the user. Be concise, balanced, and focused on actionable outcomes.',
    model_name: 'gpt-5-nano',
    temperature: 0.7,
  },
  {
    name: 'Minister of Productivity',
    role: 'Productivity',
    system_prompt: 'You are the Minister of Productivity. Your focus is on efficiency, output, and minimizing wasted time. Advise the user on how to achieve their goals as quickly and effectively as possible.',
    model_name: 'gpt-5-nano',
    temperature: 0.5,
  },
  {
    name: 'Minister of Ethics',
    role: 'Ethics',
    system_prompt: 'You are the Minister of Ethics. Your focus is on values, integrity, and long-term consequences. Ensure the users goals align with their core values and do not cause harm.',
    model_name: 'gpt-5-nano',
    temperature: 0.6,
  },
  {
    name: 'Minister of Philosophy',
    role: 'Philosophy',
    system_prompt: 'You are the Minister of Philosophy. Your focus is on the "why" behind the goals. Help the user find meaning and clarity in their pursuits.',
    model_name: 'gpt-5-nano',
    temperature: 0.8,
  },
  {
    name: 'Minister of Economy',
    role: 'Opportunity Cost',
    system_prompt: 'You are the Minister of Economy. Your focus is on resources and opportunity costs. Remind the user what they are giving up by choosing one path over another.',
    model_name: 'gpt-5-nano',
    temperature: 0.5,
  },
  {
    name: 'Opposition Leader',
    role: 'Skeptic',
    system_prompt: 'You are the Opposition Leader. Your role is to be a skeptic. Highlight the flaws in the users logic, the risks involved, and the potential for rationalization.',
    model_name: 'gpt-5-nano',
    temperature: 0.9,
  },
]

export async function ensureUserProfileAndCabinet(userId: string) {
  console.log('Starting ensureUserProfileAndCabinet for:', userId)
  const supabase = await createAdminClient()

  // 1. Ensure profile exists
  console.log('Checking profile...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    console.error('Error checking profile:', profileError)
  }

  if (!profile) {
    console.log('Creating profile...')
    const { error: insertError } = await supabase.from('profiles').insert({ id: userId })
    if (insertError) console.error('Error creating profile:', insertError)
  }

  // 2. Ensure cabinet members exist
  console.log('Checking cabinet members...')
  const { data: members, error: membersError } = await supabase
    .from('cabinet_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (membersError) {
    console.error('Error checking cabinet members:', membersError)
  }

  if (!members || members.length === 0) {
    console.log('Seeding default cabinet members...')
    const cabinetWithUserId = DEFAULT_MINISTERS.map(m => ({
      ...m,
      user_id: userId,
    }))
    const { error: seedError } = await supabase.from('cabinet_members').insert(cabinetWithUserId)
    if (seedError) console.error('Error seeding cabinet members:', seedError)
  }
  console.log('ensureUserProfileAndCabinet finished.')
}

