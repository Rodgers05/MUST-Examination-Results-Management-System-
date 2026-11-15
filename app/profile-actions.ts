'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function notice(message: string): never {
  redirect('/dashboard/profile?notice=' + encodeURIComponent(message))
}

export async function updatePersonalProfile(formData: FormData) {
  const profile = await requireActiveProfile()
  const fullName = String(formData.get('full_name') ?? '').trim()
  if (fullName.length < 2 || fullName.length > 120) notice('Enter a name between 2 and 120 characters.')

  const supabase = await createClient()
  const { error } = await supabase.from('profiles')
    .update({ full_name: fullName })
    .eq('id', profile.id)
  if (error) notice('Your profile could not be updated. Please try again.')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  notice('Your profile details have been updated.')
}

export async function updateThemePreference(formData: FormData) {
  const profile = await requireActiveProfile()
  const theme = String(formData.get('theme_preference') ?? '')
  if (!['light', 'dark', 'system'].includes(theme)) notice('Choose a valid appearance setting.')

  const supabase = await createClient()
  const { error } = await supabase.from('profiles')
    .update({ theme_preference: theme })
    .eq('id', profile.id)
  if (error) notice('Your appearance preference could not be saved.')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  notice('Appearance preference saved.')
}

export async function uploadProfileAvatar(formData: FormData) {
  const profile = await requireActiveProfile()
  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) notice('Choose a profile image first.')
  if (file.size > 2 * 1024 * 1024) notice('Profile images must be 2 MB or smaller.')
  const allowed = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])
  const extension = allowed.get(file.type)
  if (!extension) notice('Use a JPG, PNG or WebP image.')

  const supabase = await createClient()
  const path = profile.id + '/avatar-' + Date.now() + '.' + extension
  const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  })
  if (uploadError) notice('The image could not be uploaded. Check the file and try again.')

  const { error: profileError } = await supabase.from('profiles')
    .update({ avatar_path: path })
    .eq('id', profile.id)
  if (profileError) {
    await supabase.storage.from('profile-avatars').remove([path])
    notice('The image was uploaded but could not be linked to your profile. Contact support.')
  }
  if (profile.avatar_path) await supabase.storage.from('profile-avatars').remove([profile.avatar_path])
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  notice('Your profile picture has been updated.')
}
