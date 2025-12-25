'use server'

import { createClient } from './server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function deleteBriefAction(briefId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify ownership before delete
  const { data: brief } = await supabase
    .from('briefs')
    .select('user_id')
    .eq('id', briefId)
    .single()

  if (!brief || brief.user_id !== user.id) {
    throw new Error('Not authorized to delete this brief')
  }

  const { error } = await supabase
    .from('briefs')
    .delete()
    .eq('id', briefId)

  if (error) {
    throw new Error('Failed to delete brief')
  }

  revalidatePath('/')
}

export async function updateProfileAction(data: { display_name?: string }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ 
      id: user.id, 
      display_name: data.display_name 
    })

  if (error) {
    throw new Error('Failed to update profile')
  }

  revalidatePath('/')
  revalidatePath('/account')
}

