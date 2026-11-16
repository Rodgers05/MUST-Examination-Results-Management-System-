'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function notice(message: string): never {
  redirect('/profile?notice=' + encodeURIComponent(message))
}

export async function updateProfile(formData: FormData) {
  const profile = await requireActiveProfile()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const theme = String(formData.get('theme_preference') ?? 'system')
  if (fullName.length < 2 || fullName.length > 120) notice('Enter a name between 2 and 120 characters.')
  if (!['light', 'dark', 'system'].includes(theme)) notice('Choose a valid appearance preference.')
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ full_name: fullName, theme_preference: theme })
    .eq('id', profile.id)
  if (error) notice('Your profile could not be updated. Please try again.')
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  notice('Profile updated successfully.')
}

export async function uploadProfileAvatar(formData: FormData) {
  const profile = await requireActiveProfile()
  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) notice('Choose an image to upload.')
  const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']])
  const extension = allowed.get(file.type)
  if (!extension) notice('Use a JPG, PNG or WebP image.')
  if (file.size > 2 * 1024 * 1024) notice('The image must be 2 MB or smaller.')
  const supabase = await createClient()
  const path = profile.id + '/' + crypto.randomUUID() + '.' + extension
  const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, file, {
    contentType: file.type, upsert: false, cacheControl: '3600',
  })
  if (uploadError) notice('The image upload failed. Please try again.')
  const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id)
  if (updateError) {
    await supabase.storage.from('profile-avatars').remove([path])
    notice('The image was uploaded but could not be attached to your profile.')
  }
  if (profile.avatar_path) await supabase.storage.from('profile-avatars').remove([profile.avatar_path])
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  notice('Profile photo updated.')
}
