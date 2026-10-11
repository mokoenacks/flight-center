import { blankCampaign, paintChannels } from './copy'
import { addDays, isoDate, planMonday } from './format'
import type { Campaign, DeskState, Offer, StrategyId, TripKind } from './types'

const SLOTS: { offset: number; strategyId: StrategyId; offerId: string; kind: TripKind; live?: boolean }[] = [
  { offset: 0, strategyId: 'package-ladder', offerId: 'mau-holiday', kind: 'holiday', live: true },
  { offset: 2, strategyId: 'dream-then-plan', offerId: 'bali-holiday', kind: 'holiday' },
  { offset: 4, strategyId: 'quote-magnet', offerId: 'cpt-flight', kind: 'flight' },
  { offset: 6, strategyId: 'speed-to-lead', offerId: 'mau-holiday', kind: 'holiday' },
]

function choose(offers: Offer[], id: string, kind: TripKind) {
  return (
    offers.find((offer) => offer.id === id) ??
    offers.find((offer) => offer.kind === kind && offer.featured) ??
    offers.find((offer) => offer.kind === kind) ??
    offers[0]
  )
}

export function buildWeekPlan(state: DeskState): DeskState {
  if (!state.offers.length) return state
  const monday = planMonday()
  const week = isoDate(monday)
  const keys = new Set<string>()
  const built: Campaign[] = []

  for (const slot of SLOTS) {
    const offer = choose(state.offers, slot.offerId, slot.kind)
    if (!offer) continue
    const scheduledFor = isoDate(addDays(monday, slot.offset))
    const automationKey = `${week}:${slot.strategyId}:${slot.offerId}`
    keys.add(automationKey)
    const existing = state.campaigns.find((campaign) => campaign.automationKey === automationKey)
    const status: Campaign['status'] = slot.live ? 'live' : 'ready'
    built.push(
      existing
        ? paintChannels(
            {
              ...existing,
              offerId: offer.id,
              strategyId: slot.strategyId,
              scheduledFor,
              status,
              masterEdited: false,
            },
            state.settings,
            state.offers,
            { rebuildMaster: true },
          )
        : blankCampaign({
            offer,
            strategyId: slot.strategyId,
            settings: state.settings,
            offers: state.offers,
            scheduledFor,
            status,
            automationKey,
          }),
    )
  }

  const rest = state.campaigns
    .filter((campaign) => !campaign.automationKey || !keys.has(campaign.automationKey))
    .map((campaign) => (campaign.status === 'live' ? { ...campaign, status: 'ready' as const } : campaign))

  return { ...state, campaigns: [...built, ...rest] }
}
