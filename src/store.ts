import { useEffect, useState } from 'react'
import { blankCampaign, followUpsFor, paintChannels } from './copy'
import { isoDate } from './format'
import { buildWeekPlan } from './plan'
import { defaultSettings, seedOffers } from './seed'
import type { Campaign, Channel, DeskState, Lead, MasterBrief, Offer, Settings, StrategyId } from './types'

const KEY = 'flight-desk-v1'

export function createInitialState(): DeskState {
  return buildWeekPlan({
    settings: defaultSettings,
    offers: seedOffers,
    campaigns: [],
    leads: [],
  })
}

function load(): DeskState {
  if (typeof localStorage === 'undefined') return createInitialState()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as DeskState
    if (!parsed?.settings || !Array.isArray(parsed.offers) || !Array.isArray(parsed.campaigns) || !Array.isArray(parsed.leads)) {
      return createInitialState()
    }
    return parsed
  } catch {
    return createInitialState()
  }
}

let state = load()
const listeners = new Set<() => void>()

export function getState() {
  return state
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function commit(next: DeskState) {
  state = next
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state))
  listeners.forEach((listener) => listener())
}

export function update(recipe: (current: DeskState) => DeskState) {
  commit(recipe(state))
}

export function useDesk() {
  const [snapshot, setSnapshot] = useState(state)
  useEffect(() => subscribe(() => setSnapshot(getState())), [])
  return snapshot
}

export function saveSettings(settings: Settings) {
  update((current) => ({
    ...current,
    settings,
    campaigns: current.campaigns.map((campaign) =>
      paintChannels(campaign, settings, current.offers, { rebuildMaster: !campaign.masterEdited }),
    ),
  }))
}

export function saveOffer(offer: Offer) {
  update((current) => {
    const exists = current.offers.some((item) => item.id === offer.id)
    const offers = exists
      ? current.offers.map((item) => (item.id === offer.id ? offer : item))
      : [offer, ...current.offers]
    return {
      ...current,
      offers,
      campaigns: current.campaigns.map((campaign) =>
        campaign.offerId === offer.id
          ? paintChannels(campaign, current.settings, offers, { rebuildMaster: !campaign.masterEdited })
          : campaign,
      ),
    }
  })
}

export function deleteOffer(id: string) {
  update((current) => ({ ...current, offers: current.offers.filter((offer) => offer.id !== id) }))
}

export function patchCampaign(id: string, patch: Partial<Pick<Campaign, 'scheduledFor' | 'status'>>) {
  update((current) => ({
    ...current,
    campaigns: current.campaigns.map((campaign) => {
      if (patch.status === 'live' && campaign.status === 'live' && campaign.id !== id) {
        return { ...campaign, status: 'ready' }
      }
      if (campaign.id !== id) return campaign
      return { ...campaign, ...patch }
    }),
  }))
}

export function retarget(id: string, strategyId: StrategyId, offerId: string) {
  update((current) => ({
    ...current,
    campaigns: current.campaigns.map((campaign) =>
      campaign.id === id
        ? paintChannels(
            { ...campaign, strategyId, offerId, masterEdited: false },
            current.settings,
            current.offers,
            { rebuildMaster: true },
          )
        : campaign,
    ),
  }))
}

export function updateMaster(id: string, master: MasterBrief) {
  update((current) => ({
    ...current,
    campaigns: current.campaigns.map((campaign) =>
      campaign.id === id
        ? paintChannels({ ...campaign, master, masterEdited: true }, current.settings, current.offers)
        : campaign,
    ),
  }))
}

export function updateChannel(id: string, channel: Channel, body: string) {
  update((current) => ({
    ...current,
    campaigns: current.campaigns.map((campaign) => {
      if (campaign.id !== id) return campaign
      return {
        ...campaign,
        channels: {
          ...campaign.channels,
          [channel]: { ...campaign.channels[channel], body, inSync: false },
        },
      }
    }),
  }))
}

export function togglePosted(id: string, channel: Channel) {
  update((current) => ({
    ...current,
    campaigns: current.campaigns.map((campaign) => {
      if (campaign.id !== id) return campaign
      const previous = campaign.channels[channel]
      return {
        ...campaign,
        channels: {
          ...campaign.channels,
          [channel]: { ...previous, posted: !previous.posted },
        },
      }
    }),
  }))
}

export function resync(id: string, only?: Channel) {
  update((current) => ({
    ...current,
    campaigns: current.campaigns.map((campaign) => {
      if (campaign.id !== id) return campaign
      if (!only) {
        return paintChannels({ ...campaign, masterEdited: false }, current.settings, current.offers, {
          rebuildMaster: true,
          force: true,
        })
      }
      const next = {
        ...campaign,
        channels: {
          ...campaign.channels,
          [only]: { ...campaign.channels[only], inSync: true },
        },
      }
      return paintChannels(next, current.settings, current.offers)
    }),
  }))
}

export function deleteCampaign(id: string) {
  update((current) => ({ ...current, campaigns: current.campaigns.filter((campaign) => campaign.id !== id) }))
}

export function draftFromPlaybook(strategyId: StrategyId) {
  const current = getState()
  const offer = current.offers.find((item) => item.featured) ?? current.offers[0]
  if (!offer) return ''
  const scheduledFor = isoDate(new Date())
  const automationKey = `playbook:${strategyId}:${scheduledFor}`
  const existing = current.campaigns.find((campaign) => campaign.automationKey === automationKey)
  if (existing) return existing.id
  const campaign = blankCampaign({
    offer,
    strategyId,
    settings: current.settings,
    offers: current.offers,
    scheduledFor,
    status: 'draft',
    automationKey,
  })
  commit({ ...current, campaigns: [campaign, ...current.campaigns] })
  return campaign.id
}

export function runWeek() {
  update((current) => buildWeekPlan(current))
}

export function addLead(input: Omit<Lead, 'id' | 'createdAt' | 'followUps' | 'stage'> & { stage?: Lead['stage'] }) {
  const current = getState()
  const created: Lead = {
    ...input,
    stage: input.stage ?? 'new',
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    followUps: followUpsFor(input, current.settings),
  }
  commit({ ...current, leads: [created, ...current.leads] })
  return created
}

export function patchLead(id: string, patch: Partial<Lead>) {
  update((current) => ({
    ...current,
    leads: current.leads.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)),
  }))
}

export function toggleFollowUp(leadId: string, followId: string) {
  update((current) => ({
    ...current,
    leads: current.leads.map((lead) =>
      lead.id === leadId
        ? {
            ...lead,
            followUps: lead.followUps.map((item) => (item.id === followId ? { ...item, done: !item.done } : item)),
          }
        : lead,
    ),
  }))
}

export function deleteLead(id: string) {
  update((current) => ({ ...current, leads: current.leads.filter((lead) => lead.id !== id) }))
}

export function isDeskState(value: unknown): value is DeskState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as DeskState
  return Boolean(
    candidate.settings &&
      Array.isArray(candidate.offers) &&
      Array.isArray(candidate.campaigns) &&
      Array.isArray(candidate.leads),
  )
}

export function resetDemo() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
  commit(createInitialState())
}
