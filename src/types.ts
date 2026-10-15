export const CHANNELS = [
  'instagram',
  'tiktok',
  'linkedin',
  'facebook',
  'whatsapp',
  'email',
  'site',
] as const

export type Channel = (typeof CHANNELS)[number]

export type TripKind = 'flight' | 'holiday' | 'tour' | 'cruise' | 'car'

export type Palette = 'lagoon' | 'dusk' | 'alpine' | 'spice' | 'city' | 'vine'

export type StrategyId =
  | 'price-anchor'
  | 'quote-magnet'
  | 'dream-then-plan'
  | 'package-ladder'
  | 'social-proof'
  | 'seasonal-wave'
  | 'speed-to-lead'

export type Offer = {
  id: string
  destination: string
  country: string
  kind: TripKind
  priceFrom: number
  nights: string
  blurb: string
  includes: string
  departFrom: string
  travelWindow: string
  featured: boolean
  palette: Palette
}

export type MasterBrief = {
  hook: string
  offer: string
  priceLabel: string
  cta: string
  proof: string
  terms: string
}

export type ChannelCopy = {
  body: string
  inSync: boolean
  posted: boolean
}

export type Campaign = {
  id: string
  offerId: string
  strategyId: StrategyId
  title: string
  status: 'draft' | 'ready' | 'live'
  scheduledFor: string
  automationKey: string
  masterEdited: boolean
  master: MasterBrief
  channels: Record<Channel, ChannelCopy>
  createdAt: string
}

export type FollowUp = {
  id: string
  dayLabel: string
  channel: 'whatsapp' | 'email'
  message: string
  done: boolean
}

export type LeadStage = 'new' | 'contacted' | 'quoted' | 'booked' | 'lost'

export type Lead = {
  id: string
  name: string
  phone: string
  email: string
  from: string
  to: string
  dates: string
  travellers: string
  kind: TripKind | 'unsure'
  notes: string
  source: string
  stage: LeadStage
  createdAt: string
  followUps: FollowUp[]
}

export type Settings = {
  slug: string
  agencyName: string
  agentName: string
  tagline: string
  city: string
  phone: string
  email: string
  whatsapp: string
  bio: string
  trustLine: string
  instagram: string
  tiktok: string
  linkedin: string
  facebook: string
  leadWebhook: string
  preview: boolean
}

export type DeskState = {
  agentId: string
  slug: string
  settings: Settings
  offers: Offer[]
  campaigns: Campaign[]
  leads: Lead[]
}

export const KIND_LABEL: Record<TripKind, string> = {
  flight: 'Flight',
  holiday: 'Holiday',
  tour: 'Tour',
  cruise: 'Cruise',
  car: 'Car',
}

export const CHANNEL_META: Record<Channel, { label: string; hint: string }> = {
  instagram: { label: 'Instagram', hint: 'Feed caption and hashtags' },
  tiktok: { label: 'TikTok', hint: 'Spoken script plus a short caption' },
  linkedin: { label: 'LinkedIn', hint: 'A calm advisor post' },
  facebook: { label: 'Facebook', hint: 'A community post that asks a question' },
  whatsapp: { label: 'WhatsApp', hint: 'A note you can send to a client' },
  email: { label: 'Email', hint: 'Subject line and letter' },
  site: { label: 'Customer page', hint: 'The sentence under the destination' },
}

export const EMPTY_BRIEF: MasterBrief = {
  hook: '',
  offer: '',
  priceLabel: '',
  cta: '',
  proof: '',
  terms: '',
}
