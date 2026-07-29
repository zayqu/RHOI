import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url!, key!) : null

export interface ClientRow {
  id: string
  organization_id: string
  client_number: string
  full_name: string
  phone: string
  alternate_phone: string | null
  email: string | null
  id_type: string | null
  id_number: string | null
  address: string | null
  occupation: string | null
  monthly_income_tzs: number | null
  notification_channel: string
  reminder_consent: boolean
  status: 'active' | 'inactive' | 'restricted' | 'blacklisted'
  notes: string | null
  created_at: string
}

export const clientNumber = () =>
  `RHC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
