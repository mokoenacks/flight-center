import { useEffect, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildWeekPlan } from './plan'
import { defaultSettings, seedOffers } from './seed'
import { prettyDate } from './format'
import type { Campaign, Channel, ChannelCopy, DeskState, FollowUp, Lead, LeadStage, MasterBrief, Offer, Palette, Settings, StrategyId, TripKind } from './types'
import { CHANNELS } from './types'

const url = (
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ??
  import.meta.env.VITE_SUPABASE_URL ??
  'https://jksnuuemyusbsvuunhkz.supabase.co'
).trim()
const anonKey = (
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_JsXInJZcvUq71O_vJAC63w_j7bbXney'
).trim()
const client: SupabaseClient | null =
  url.startsWith('https://') && anonKey.length > 20
    ? createClient(url, anonKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null

const SAVE_ERROR = 'The database did not save. Run supabase/multi-agent.sql in the Supabase SQL editor, then sign in again.'
const LOAD_ERROR = 'The database did not answer. Check the Supabase URL and publishable key in .env.'
const SCHEMA_ERROR = 'Run supabase/multi-agent.sql in the Supabase SQL editor, then refresh.'
const QUOTE_ERROR = 'The quote did not reach the desk. Try again.'
const MAIL_ERROR = 'Your quote is saved. The email to the consultant did not send.'
const RESERVED_SLUGS = new Set(['admin', 'a', 'api'])

export type RemoteStatus = {
  configured: boolean
  ready: boolean
  signedIn: boolean
  recovery: boolean
  email: string
  error: string
  view: 'loading' | 'ready' | 'idle' | 'missing'
}

const status: RemoteStatus = {
  configured: client !== null,
  ready: client === null,
  signedIn: false,
  recovery: false,
  email: '',
  error: '',
  view: client === null ? 'ready' : 'loading',
}

type Scope = { mode: 'admin' | 'public' | 'idle'; agentId: string; slug: string; userId: string }
let scope: Scope = { mode: 'idle', agentId: '', slug: '', userId: '' }

export function usingDatabase() {
  return client !== null
}

const listeners = new Set<(next: RemoteStatus) => void>()
let bridge: { read: () => DeskState; write: (next: DeskState) => void } | null = null
let signedIn = false
let booted = client === null
let timer = 0
let pushGen = 0
let chain: Promise<void> = Promise.resolve()
let leadIds = new Set<string>()

function notify() {
  const snapshot = { ...status }
  listeners.forEach((listener) => listener(snapshot))
}

export function useRemoteStatus() {
  const [snapshot, setSnapshot] = useState<RemoteStatus>({ ...status })
  useEffect(() => {
    const listener = (next: RemoteStatus) => setSnapshot(next)
    listeners.add(listener)
    setSnapshot({ ...status })
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return snapshot
}

let bootPromise = Promise.resolve()
let openGen = 0

export function connectDesk(next: { read: () => DeskState; write: (next: DeskState) => void }) {
  bridge = next
  bootPromise = boot()
}

export function queueRemoteSave() {
  if (!client || !signedIn || !booted || scope.mode !== 'admin' || !scope.agentId) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void runPush()
  }, 400)
}

export type ViewReport = {
  pageViews: number
  pageVisitors: number
  homeViews: number
  termsViews: number
  days: { day: string; label: string; views: number }[]
}

function johannesburgDay(offset = 0) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function visitorId() {
  const existing = localStorage.getItem('flight-desk-visitor')
  if (existing && existing.length >= 8 && existing.length <= 80) return existing
  const next = crypto.randomUUID()
  localStorage.setItem('flight-desk-visitor', next)
  return next
}

const counted = new Set<string>()

export function recordView(path: 'home' | 'terms' | 'customer', agentId = '') {
  if (!client) return
  const key = `${path}:${agentId}:${johannesburgDay()}`
  if (counted.has(key) || sessionStorage.getItem(`flight-desk-seen:${key}`)) return
  counted.add(key)
  sessionStorage.setItem(`flight-desk-seen:${key}`, '1')
  if (path === 'customer' && scope.slug) sessionStorage.setItem('flight-desk-slug', scope.slug)
  const row: { path: string; visitor_id: string; agent_id?: string } = { path, visitor_id: visitorId() }
  if (agentId) row.agent_id = agentId
  void client.from('page_views').insert(row)
}

export async function loadViewReport(): Promise<ViewReport | null> {
  if (!client || !signedIn) return null
  const { data, error } = await client.rpc('view_report')
  if (error || !data || typeof data !== 'object') return null
  const row = data as {
    page_views?: number
    page_visitors?: number
    home_views?: number
    terms_views?: number
    days?: { day?: string; views?: number }[]
  }
  const counts = new Map(
    (row.days ?? []).map((entry) => [String(entry.day ?? '').slice(0, 10), Number(entry.views ?? 0)]),
  )
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = johannesburgDay(index - 6)
    return { day, label: prettyDate(day), views: counts.get(day) ?? 0 }
  })
  return {
    pageViews: Number(row.page_views ?? 0),
    pageVisitors: Number(row.page_visitors ?? 0),
    homeViews: Number(row.home_views ?? 0),
    termsViews: Number(row.terms_views ?? 0),
    days,
  }
}

export async function persistLead(lead: Lead, notifyEmail = false) {
  if (!client) return ''
  if (!scope.agentId) return 'This page is not linked to a consultant.'
  if (scope.mode === 'admin') {
    const problem = await runPush()
    if (problem) return problem
  } else {
    const { error } = await client.from('leads').insert(leadToRow(lead))
    if (error) return schemaHint(error.message) || QUOTE_ERROR
  }
  if (!notifyEmail) return ''
  const { data, error } = await client.functions.invoke('notify-agent', { body: { leadId: lead.id } })
  if (error || !data?.sent) return MAIL_ERROR
  return ''
}

export async function signInDesk(email: string, password: string) {
  if (!client) return 'Add the Supabase URL and publishable key to .env, then restart.'
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (!error) return ''
  if (/confirm/i.test(error.message)) return 'Confirm that email from the Supabase message, then sign in.'
  return 'That email or password is not right.'
}

export async function signUpDesk(email: string, password: string) {
  if (!client) return 'Add the Supabase URL and publishable key to .env, then restart.'
  if (password.length < 6) return 'Use at least 6 characters for the password.'
  const { data, error } = await client.auth.signUp({ email: email.trim(), password })
  if (error) return 'That account could not be created. Try another email.'
  if (!data.session) return 'Check your email to confirm the account, then sign in.'
  return ''
}

export async function signOutDesk() {
  if (!client) return
  status.recovery = false
  await client.auth.signOut()
}

export function passwordResetReturnUrl() {
  return `${window.location.origin}/`
}

export async function sendPasswordReset(email: string) {
  if (!client) return 'Add the Supabase URL and publishable key to .env, then restart.'
  const address = email.trim()
  if (!address.includes('@')) return 'Enter the email on the account.'
  const { error } = await client.auth.resetPasswordForEmail(address, { redirectTo: passwordResetReturnUrl() })
  if (!error) return ''
  if (/redirect/i.test(error.message)) {
    return 'Supabase blocked the return link. In Authentication, URL Configuration, allow this site, then try again.'
  }
  if (/rate|once every/i.test(error.message)) return 'Wait a minute, then ask for another email.'
  return 'The reset email did not send. Check the address and try again.'
}

export async function saveNewPassword(password: string) {
  if (!client) return 'Add the Supabase URL and publishable key to .env, then restart.'
  if (password.length < 6) return 'Use at least 6 characters for the password.'
  const { error } = await client.auth.updateUser({ password })
  if (error) return 'That password was not saved. Ask for a new reset email and try again.'
  status.recovery = false
  notify()
  if (window.location.hash.toLowerCase().startsWith('#/admin')) void openAdmin()
  return ''
}

async function boot() {
  if (!client || !bridge) {
    status.ready = true
    status.view = 'ready'
    notify()
    return
  }
  const { data } = await client.auth.getSession()
  applySession(data.session?.user.email ?? '', Boolean(data.session))
  booted = true
  status.ready = true
  notify()
  client.auth.onAuthStateChange((event, session) => {
    if (!booted) return
    if (event === 'PASSWORD_RECOVERY') {
      status.recovery = true
      applySession(session?.user.email ?? '', Boolean(session))
      if (!window.location.hash.toLowerCase().startsWith('#/admin')) window.location.hash = '#/admin'
      notify()
      return
    }
    if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return
    applySession(session?.user.email ?? '', Boolean(session))
    if (event === 'SIGNED_OUT') {
      status.recovery = false
      window.clearTimeout(timer)
      unwatch()
      scope = { mode: 'idle', agentId: '', slug: '', userId: '' }
      notify()
      return
    }
    if (status.recovery) {
      notify()
      return
    }
    if (window.location.hash.toLowerCase().startsWith('#/admin')) void openAdmin()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && signedIn && booted && scope.mode === 'admin') void runPush()
  })
}

export async function openIdle() {
  const gen = ++openGen
  await bootPromise
  if (gen !== openGen) return
  if (!client || !bridge) {
    scope = { mode: 'idle', agentId: '', slug: '', userId: '' }
    status.view = 'ready'
    status.error = ''
    notify()
    return
  }
  const { data, error } = await client.from('agent').select('slug').not('slug', 'is', null)
  if (gen !== openGen) return
  const slugs = [
    ...new Set(
      (data ?? [])
        .map((row) => text((row as { slug?: unknown }).slug).toLowerCase())
        .filter((slug) => /^[a-z0-9-]{3,40}$/.test(slug)),
    ),
  ]
  if (!error && slugs.length === 1) {
    await openCustomer(slugs[0])
    return
  }
  scope = { mode: 'idle', agentId: '', slug: '', userId: '' }
  status.view = 'idle'
  status.error = error ? schemaHint(error.message) || LOAD_ERROR : ''
  bridge.write(emptyDesk())
  notify()
}

export async function openCustomer(slug: string) {
  const gen = ++openGen
  await bootPromise
  if (gen !== openGen) return
  const clean = slug.trim().toLowerCase()
  scope = { mode: 'public', agentId: '', slug: clean, userId: '' }
  status.view = 'loading'
  status.error = ''
  notify()
  if (!client || !bridge) {
    status.view = 'missing'
    notify()
    return
  }
  const { data, error } = await client.from('agent').select('*').eq('slug', clean).maybeSingle()
  if (gen !== openGen) return
  if (error) {
    status.error = schemaHint(error.message) || LOAD_ERROR
    status.view = 'missing'
    notify()
    return
  }
  if (!data) {
    bridge.write(emptyDesk())
    status.view = 'missing'
    notify()
    return
  }
  const row = data as Record<string, unknown>
  scope.agentId = text(row.id)
  const loaded = await fetchDesk(false)
  if (gen !== openGen) return
  if (loaded.error || !bridge) {
    status.error = loaded.error
    status.view = 'missing'
    notify()
    return
  }
  bridge.write(loaded.desk)
  status.view = 'ready'
  notify()
}

export async function openAdmin() {
  const gen = ++openGen
  await bootPromise
  if (gen !== openGen) return
  if (!client || !bridge || !signedIn) {
    status.view = 'ready'
    notify()
    return
  }
  status.view = 'loading'
  status.error = ''
  notify()
  const claimed = await claimAgent()
  if (gen !== openGen || !claimed || !bridge) {
    status.view = 'ready'
    notify()
    return
  }
  scope = { mode: 'admin', agentId: claimed.id, slug: claimed.slug, userId: claimed.userId }
  const loaded = await fetchDesk(true)
  if (gen !== openGen) return
  if (loaded.error || !bridge) {
    status.error = loaded.error
    status.view = 'ready'
    notify()
    return
  }
  const desk =
    loaded.desk.offers.length === 0 && loaded.desk.campaigns.length === 0
      ? freshDesk(claimed.id, claimed.slug, loaded.desk.settings)
      : loaded.desk
  leadIds = new Set(desk.leads.map((lead) => lead.id))
  bridge.write(desk)
  if (loaded.desk.offers.length === 0 && loaded.desk.campaigns.length === 0) await runPush()
  watchLeads()
  status.view = 'ready'
  notify()
}

function applySession(email: string, nextSignedIn: boolean) {
  signedIn = nextSignedIn
  status.signedIn = nextSignedIn
  status.email = email
}

function schemaHint(message: string) {
  if (/slug|user_id|agent_id|current_agent_id|schema cache/i.test(message)) return SCHEMA_ERROR
  return ''
}

function emptyDesk(): DeskState {
  return { agentId: '', slug: '', settings: defaultSettings, offers: [], campaigns: [], leads: [] }
}

function freshDesk(agentId: string, slug: string, settings: Settings): DeskState {
  const offers = seedOffers.map((offer) => ({ ...offer, id: `${agentId.slice(0, 8)}-${offer.id}` }))
  return buildWeekPlan({ agentId, slug, settings: { ...settings, slug }, offers, campaigns: [], leads: [] })
}

async function claimAgent(): Promise<{ id: string; slug: string; userId: string } | null> {
  if (!client) return null
  const { data: userData, error: userError } = await client.auth.getUser()
  const user = userData.user
  if (userError || !user) {
    status.error = 'Sign in again to open your desk.'
    return null
  }
  const { data: mine, error: mineError } = await client.from('agent').select('*').eq('user_id', user.id).maybeSingle()
  if (mineError) {
    status.error = schemaHint(mineError.message) || LOAD_ERROR
    return null
  }
  if (mine) {
    const row = mine as Record<string, unknown>
    return { id: text(row.id), slug: text(row.slug), userId: user.id }
  }
  const { data: open, error: openError } = await client.from('agent').select('*').is('user_id', null).limit(1).maybeSingle()
  if (openError) {
    status.error = schemaHint(openError.message) || LOAD_ERROR
    return null
  }
  if (open) {
    const row = open as Record<string, unknown>
    const slug = text(row.slug) || (await uniqueSlug(slugFromEmail(user.email ?? '')))
    const { error } = await client
      .from('agent')
      .update({ user_id: user.id, slug, email: text(row.email) || user.email || '' })
      .eq('id', text(row.id))
    if (error) {
      status.error = schemaHint(error.message) || SAVE_ERROR
      return null
    }
    return { id: text(row.id), slug, userId: user.id }
  }
  const slug = await uniqueSlug(slugFromEmail(user.email ?? ''))
  const { error } = await client.from('agent').insert({
    id: user.id,
    user_id: user.id,
    slug,
    email: user.email ?? '',
    agency_name: defaultSettings.agencyName,
    agent_name: defaultSettings.agentName,
    tagline: defaultSettings.tagline,
    city: defaultSettings.city,
    bio: defaultSettings.bio,
    trust_line: defaultSettings.trustLine,
    preview: true,
  })
  if (error) {
    status.error = schemaHint(error.message) || SAVE_ERROR
    return null
  }
  return { id: user.id, slug, userId: user.id }
}

function slugFromEmail(email: string) {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return base.length >= 3 ? base : 'desk'
}

async function uniqueSlug(base: string) {
  if (!client) return base
  let slug = RESERVED_SLUGS.has(base) ? `${base}-desk` : base
  for (let n = 2; n < 30; n += 1) {
    const { data } = await client.from('agent').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${n}`
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

async function runPush() {
  window.clearTimeout(timer)
  const job = chain.then(() => writeDesk())
  chain = job.then(
    () => undefined,
    () => undefined,
  )
  return job
}

async function writeDesk() {
  if (!client || !bridge || !signedIn || scope.mode !== 'admin' || !scope.agentId) return ''
  const gen = ++pushGen
  const current = bridge.read()
  if (current.settings.slug) scope.slug = current.settings.slug
  const agentResult = await client.from('agent').upsert(settingsToRow(current.settings))
  if (agentResult.error) {
    if (/duplicate|unique/i.test(agentResult.error.message)) {
      status.error = 'That link name is already used. Choose another.'
      notify()
      return status.error
    }
    return fail()
  }
  if (gen !== pushGen || !bridge) return ''

  const offers = bridge.read().offers
  if (offers.length) {
    const offerResult = await client.from('offers').upsert(offers.map(offerToRow))
    if (offerResult.error) return fail()
  }
  if (gen !== pushGen || !bridge) return ''
  const offerDelete = await deleteMissing('offers', bridge.read().offers.map((offer) => offer.id))
  if (offerDelete) return offerDelete

  const campaigns = bridge.read().campaigns
  if (campaigns.length) {
    const campaignResult = await client.from('campaigns').upsert(campaigns.map(campaignToRow))
    if (campaignResult.error) return fail()
  }
  if (gen !== pushGen || !bridge) return ''
  const campaignDelete = await deleteMissing('campaigns', bridge.read().campaigns.map((campaign) => campaign.id))
  if (campaignDelete) return campaignDelete

  const leadProblem = await pushLeads(bridge.read().leads)
  if (leadProblem) return leadProblem
  if (status.error) {
    status.error = ''
    notify()
  }
  return ''
}

async function pushLeads(leads: Lead[]) {
  if (!client) return ''
  const removed = [...leadIds].filter((id) => !leads.some((lead) => lead.id === id))
  if (leads.length) {
    const { error } = await client.from('leads').upsert(leads.map(leadToRow))
    if (error) return fail()
  }
  if (removed.length) {
    const { error } = await client.from('leads').delete().in('id', removed)
    if (error) return fail()
  }
  if (!bridge) return ''
  for (const lead of bridge.read().leads) leadIds.add(lead.id)
  for (const id of removed) leadIds.delete(id)
  return ''
}

async function deleteMissing(table: 'offers' | 'campaigns', ids: string[]) {
  if (!client || !scope.agentId) return ''
  const query = client.from(table).delete().eq('agent_id', scope.agentId)
  const filtered = ids.length ? query.not('id', 'in', inList(ids)) : query.not('id', 'is', null)
  const { error } = await filtered
  return error ? fail() : ''
}

function fail() {
  status.error = SAVE_ERROR
  notify()
  return SAVE_ERROR
}

let leadChannel: ReturnType<SupabaseClient['channel']> | null = null

function watchLeads() {
  if (!client || leadChannel || !bridge) return
  leadChannel = client
    .channel('flight-desk-leads')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
      if (!bridge) return
      if (payload.eventType === 'DELETE') {
        const id = String((payload.old as { id?: string }).id ?? '')
        if (!id) return
        leadIds.delete(id)
        const current = bridge.read()
        bridge.write({ ...current, leads: current.leads.filter((lead) => lead.id !== id) })
        return
      }
      const record = payload.new as Record<string, unknown>
      if (text(record.agent_id) !== scope.agentId) return
      const lead = rowToLead(record)
      if (!lead) return
      leadIds.add(lead.id)
      const current = bridge.read()
      const exists = current.leads.some((item) => item.id === lead.id)
      bridge.write({
        ...current,
        leads: exists ? current.leads.map((item) => (item.id === lead.id ? lead : item)) : [lead, ...current.leads],
      })
    })
    .subscribe()
}

function unwatch() {
  if (!client || !leadChannel) return
  void client.removeChannel(leadChannel)
  leadChannel = null
}

async function fetchDesk(includeLeads: boolean): Promise<{ desk: DeskState; error: string }> {
  const empty = emptyDesk()
  if (!client || !scope.agentId) return { desk: empty, error: '' }
  const [agent, offers, campaigns, leads] = await Promise.all([
    client.from('agent').select('*').eq('id', scope.agentId).maybeSingle(),
    client.from('offers').select('*').eq('agent_id', scope.agentId).order('sort_order', { ascending: true }),
    client.from('campaigns').select('*').eq('agent_id', scope.agentId).order('sort_order', { ascending: true }),
    includeLeads
      ? client.from('leads').select('*').eq('agent_id', scope.agentId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (agent.error || offers.error || campaigns.error || leads.error) {
    const message = agent.error?.message || offers.error?.message || campaigns.error?.message || leads.error?.message || ''
    return { desk: empty, error: schemaHint(message) || LOAD_ERROR }
  }
  const settings = agent.data ? rowToSettings(agent.data as Record<string, unknown>) : { ...defaultSettings, slug: scope.slug }
  if (settings.slug) scope.slug = settings.slug
  return {
    desk: {
      agentId: scope.agentId,
      slug: scope.slug,
      settings,
      offers: (offers.data ?? []).flatMap((row) => {
        const offer = rowToOffer(row)
        return offer ? [offer] : []
      }),
      campaigns: (campaigns.data ?? []).flatMap((row) => {
        const campaign = rowToCampaign(row)
        return campaign ? [campaign] : []
      }),
      leads: (leads.data ?? []).flatMap((row) => {
        const lead = rowToLead(row)
        return lead ? [lead] : []
      }),
    },
    error: '',
  }
}

function inList(ids: string[]) {
  return `(${ids.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`
}

function settingsToRow(settings: Settings) {
  return {
    id: scope.agentId,
    user_id: scope.userId,
    slug: settings.slug || scope.slug,
    agency_name: settings.agencyName,
    agent_name: settings.agentName,
    tagline: settings.tagline,
    city: settings.city,
    phone: settings.phone,
    email: settings.email,
    whatsapp: settings.whatsapp,
    bio: settings.bio,
    trust_line: settings.trustLine,
    instagram: settings.instagram,
    tiktok: settings.tiktok,
    linkedin: settings.linkedin,
    facebook: settings.facebook,
    lead_webhook: settings.leadWebhook,
    preview: settings.preview,
    updated_at: new Date().toISOString(),
  }
}

function offerToRow(offer: Offer, index: number) {
  return {
    id: offer.id,
    destination: offer.destination,
    country: offer.country,
    kind: offer.kind,
    price_from: offer.priceFrom,
    nights: offer.nights,
    blurb: offer.blurb,
    includes: offer.includes,
    depart_from: offer.departFrom,
    travel_window: offer.travelWindow,
    featured: offer.featured,
    palette: offer.palette,
    agent_id: scope.agentId,
    sort_order: index,
    updated_at: new Date().toISOString(),
  }
}

function campaignToRow(campaign: Campaign, index: number) {
  return {
    id: campaign.id,
    offer_id: campaign.offerId,
    strategy_id: campaign.strategyId,
    title: campaign.title,
    status: campaign.status,
    scheduled_for: campaign.scheduledFor,
    automation_key: campaign.automationKey,
    master_edited: campaign.masterEdited,
    master: campaign.master,
    channels: campaign.channels,
    agent_id: scope.agentId,
    sort_order: index,
    created_at: campaign.createdAt,
  }
}

function leadToRow(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    from_place: lead.from,
    to_place: lead.to,
    dates: lead.dates,
    travellers: lead.travellers,
    kind: lead.kind,
    notes: lead.notes,
    source: lead.source,
    stage: lead.stage,
    follow_ups: lead.followUps,
    created_at: lead.createdAt,
    agent_id: scope.agentId,
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function rowToSettings(row: Record<string, unknown>): Settings {
  return {
    slug: text(row.slug),
    agencyName: text(row.agency_name) || defaultSettings.agencyName,
    agentName: text(row.agent_name),
    tagline: text(row.tagline),
    city: text(row.city),
    phone: text(row.phone),
    email: text(row.email),
    whatsapp: text(row.whatsapp),
    bio: text(row.bio),
    trustLine: text(row.trust_line),
    instagram: text(row.instagram),
    tiktok: text(row.tiktok),
    linkedin: text(row.linkedin),
    facebook: text(row.facebook),
    leadWebhook: text(row.lead_webhook),
    preview: row.preview !== false,
  }
}

const OFFER_KINDS = new Set<TripKind>(['flight', 'holiday', 'tour', 'cruise', 'car'])
const PALETTES = new Set<Palette>(['lagoon', 'dusk', 'alpine', 'spice', 'city', 'vine'])
const STRATEGIES = new Set<StrategyId>([
  'price-anchor',
  'quote-magnet',
  'dream-then-plan',
  'package-ladder',
  'social-proof',
  'seasonal-wave',
  'speed-to-lead',
])
const STAGES = new Set<LeadStage>(['new', 'contacted', 'quoted', 'booked', 'lost'])

function rowToOffer(row: Record<string, unknown>): Offer | null {
  const kind = text(row.kind) as TripKind
  const palette = text(row.palette) as Palette
  if (!text(row.id) || !OFFER_KINDS.has(kind)) return null
  return {
    id: text(row.id),
    destination: text(row.destination),
    country: text(row.country),
    kind,
    priceFrom: typeof row.price_from === 'number' ? row.price_from : 0,
    nights: text(row.nights),
    blurb: text(row.blurb),
    includes: text(row.includes),
    departFrom: text(row.depart_from),
    travelWindow: text(row.travel_window),
    featured: Boolean(row.featured),
    palette: PALETTES.has(palette) ? palette : 'lagoon',
  }
}

function rowToCampaign(row: Record<string, unknown>): Campaign | null {
  const strategyId = text(row.strategy_id) as StrategyId
  const status = text(row.status)
  if (!text(row.id) || !STRATEGIES.has(strategyId)) return null
  if (status !== 'draft' && status !== 'ready' && status !== 'live') return null
  return {
    id: text(row.id),
    offerId: text(row.offer_id),
    strategyId,
    title: text(row.title),
    status,
    scheduledFor: text(row.scheduled_for).slice(0, 10),
    automationKey: text(row.automation_key),
    masterEdited: Boolean(row.master_edited),
    master: asBrief(row.master),
    channels: asChannels(row.channels),
    createdAt: text(row.created_at) || new Date().toISOString(),
  }
}

function rowToLead(row: unknown): Lead | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const kind = text(record.kind)
  const stage = text(record.stage) as LeadStage
  if (!text(record.id) || !text(record.name)) return null
  const leadKind: Lead['kind'] =
    kind === 'unsure' || OFFER_KINDS.has(kind as TripKind) ? (kind as Lead['kind']) : 'unsure'
  return {
    id: text(record.id),
    name: text(record.name),
    phone: text(record.phone),
    email: text(record.email),
    from: text(record.from_place),
    to: text(record.to_place),
    dates: text(record.dates),
    travellers: text(record.travellers),
    kind: leadKind,
    notes: text(record.notes),
    source: text(record.source),
    stage: STAGES.has(stage) ? stage : 'new',
    createdAt: text(record.created_at) || new Date().toISOString(),
    followUps: asFollowUps(record.follow_ups),
  }
}

function asBrief(value: unknown): MasterBrief {
  const raw = value && typeof value === 'object' ? (value as Partial<MasterBrief>) : {}
  return {
    hook: raw.hook ?? '',
    offer: raw.offer ?? '',
    priceLabel: raw.priceLabel ?? '',
    cta: raw.cta ?? '',
    proof: raw.proof ?? '',
    terms: raw.terms ?? '',
  }
}

function asChannels(value: unknown): Record<Channel, ChannelCopy> {
  const raw = value && typeof value === 'object' ? (value as Partial<Record<Channel, ChannelCopy>>) : {}
  const channels = {} as Record<Channel, ChannelCopy>
  for (const channel of CHANNELS) {
    const item = raw[channel]
    channels[channel] = {
      body: item?.body ?? '',
      inSync: item?.inSync ?? true,
      posted: item?.posted ?? false,
    }
  }
  return channels
}

function asFollowUps(value: unknown): FollowUp[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Partial<FollowUp>
    if (!row.id || (row.channel !== 'whatsapp' && row.channel !== 'email')) return []
    return [
      {
        id: row.id,
        dayLabel: row.dayLabel ?? '',
        channel: row.channel,
        message: row.message ?? '',
        done: Boolean(row.done),
      },
    ]
  })
}
