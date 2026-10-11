import { money, waDigits } from './format'
import { strategyName } from './playbooks'
import type {
  Campaign,
  Channel,
  ChannelCopy,
  FollowUp,
  MasterBrief,
  Offer,
  Settings,
  StrategyId,
} from './types'
import { CHANNELS, EMPTY_BRIEF, KIND_LABEL } from './types'

type RenderInput = {
  strategyId: StrategyId
  master: MasterBrief
  offer: Offer
  settings: Settings
  offers: Offer[]
}

const DREAMS: Record<string, string> = {
  Mauritius: 'Warm water, a short flight from Johannesburg, and a week that feels properly away.',
  Bali: 'A long flight that makes sense when the hotel, the transfer, and the pace are right.',
  Thailand: 'Street food, a beach, and two cities that should be planned as one trip.',
  'Cape Town': 'The mountain, the sea, and a weekend that does not need a passport.',
  Mediterranean: 'A week of ports, with the hotel moving while you sleep.',
  'Kruger and Cape Town': 'Early game drives, then the city, without booking five suppliers yourself.',
  London: 'A direct reason to go, and a fare that is worth checking before school holidays.',
  'New Zealand': 'Lakes, a hire car, and days with more road than schedule.',
}

export function buildMaster(
  strategyId: StrategyId,
  offer: Offer,
  settings: Settings,
  offers: Offer[],
): MasterBrief {
  const agency = settings.agencyName.trim() || 'us'
  const price = `From ${money(offer.priceFrom)} per person`
  const cluster = offers.filter((item) => item.destination === offer.destination)
  const hook: Record<StrategyId, string> = {
    'price-anchor': `${offer.destination} from ${money(offer.priceFrom)} per person.`,
    'quote-magnet': `Ask for a checked fare to ${offer.destination}. There is no fee to ask.`,
    'dream-then-plan':
      DREAMS[offer.destination] ??
      `${offer.destination} is an easy trip to want, and a better one to plan properly.`,
    'package-ladder':
      cluster.length > 1
        ? `${offer.destination}, ${cluster.length} ways to go. Choose the spend that fits.`
        : `${offer.destination}, one clear offer this week.`,
    'social-proof': `Here is how a trip to ${offer.destination} actually gets booked.`,
    'seasonal-wave': `${offer.travelWindow}: ${offer.destination} is one to quote now.`,
    'speed-to-lead': `Send dates for ${offer.destination} and I will reply with a live fare.`,
  }
  const when = [offer.nights, offer.departFrom ? `leaving ${offer.departFrom}` : ''].filter(Boolean).join(', ')
  const offerLine = [offer.blurb, offer.includes ? `Included: ${offer.includes}.` : '', when ? `${when}.` : '']
    .filter(Boolean)
    .join(' ')

  return {
    hook: hook[strategyId],
    offer: offerLine,
    priceLabel: price,
    cta: `WhatsApp ${agency} with your dates.`,
    proof: settings.trustLine.trim() || 'One consultant stays with the booking from the first message.',
    terms: settings.preview
      ? 'Sample from-price for planning. Replace it with a fare you can ticket before you advertise it.'
      : 'From-price per person. Availability can change. We confirm the fare with you before you pay.',
  }
}

function contactLine(settings: Settings) {
  const bits: string[] = []
  if (settings.whatsapp.trim()) bits.push(`WhatsApp ${settings.whatsapp.trim()}`)
  if (settings.phone.trim()) bits.push(`call ${settings.phone.trim()}`)
  if (settings.email.trim()) bits.push(settings.email.trim())
  const agency = settings.agencyName.trim() || 'the desk'
  if (!bits.length) return `Message ${agency} and ask for a checked quote.`
  return `Reach ${agency} on ${bits.join(' · ')}.`
}

function hashtags(offer: Offer) {
  const place = offer.destination.replace(/[^A-Za-z0-9]/g, '') || 'Travel'
  const kind = {
    flight: 'Flights',
    holiday: 'HolidayDeals',
    tour: 'Tours',
    cruise: 'Cruises',
    car: 'CarHire',
  }[offer.kind]
  return `#${place} #${kind} #SouthAfricanTravel #TravelQuote`
}

function ladderBlock(input: RenderInput) {
  const rows = input.offers.filter((offer) => offer.destination === input.offer.destination)
  if (rows.length < 2) {
    return `One option this week: ${KIND_LABEL[input.offer.kind]} from ${money(input.offer.priceFrom)} per person.`
  }
  return rows
    .map((offer) => `${KIND_LABEL[offer.kind]}: from ${money(offer.priceFrom)} per person`)
    .join('\n')
}

function extraBlock(input: RenderInput) {
  switch (input.strategyId) {
    case 'package-ladder':
      return ladderBlock(input)
    case 'seasonal-wave':
      return `When: ${input.offer.travelWindow}.`
    case 'speed-to-lead':
      return 'Reply with your departure city, dates, and who is travelling.'
    case 'quote-magnet':
      return 'Asking is free. You decide after the fare is confirmed.'
    default:
      return ''
  }
}

function opening(input: RenderInput) {
  if (input.strategyId === 'price-anchor') {
    return `${input.master.priceLabel} — ${input.offer.destination}.`
  }
  return input.master.hook
}

function paragraphs(lines: string[]) {
  return lines.filter(Boolean).join('\n\n')
}

function renderInstagram(input: RenderInput) {
  return paragraphs([
    opening(input),
    input.master.offer,
    input.strategyId === 'price-anchor' ? '' : input.master.priceLabel,
    extraBlock(input),
    input.master.proof,
    input.master.cta,
    contactLine(input.settings),
    input.master.terms,
    hashtags(input.offer),
  ])
}

function renderTikTok(input: RenderInput) {
  return [
    'SCRIPT',
    `0–2s: Look at the camera and say, "${opening(input)}"`,
    `2–7s: Put this price on screen: ${input.master.priceLabel}.`,
    `7–12s: Say what is included: "${input.offer.includes}".`,
    `12–16s: Close with, "${input.master.cta}"`,
    '',
    'CAPTION',
    `${opening(input)} ${input.master.priceLabel}`,
    input.master.cta,
    input.master.terms,
    hashtags(input.offer),
  ].join('\n')
}

function renderLinkedIn(input: RenderInput) {
  return paragraphs([
    opening(input),
    `I am quoting ${input.offer.destination} for travellers leaving ${input.offer.departFrom || input.settings.city}. ${input.master.offer}`,
    `${input.master.priceLabel}.`,
    extraBlock(input),
    input.master.proof,
    `${input.master.cta} ${contactLine(input.settings)}`,
    input.master.terms,
  ])
}

function renderFacebook(input: RenderInput) {
  return paragraphs([
    opening(input),
    `${input.master.offer} ${input.master.priceLabel}.`,
    extraBlock(input),
    input.master.proof,
    `${input.master.cta} ${contactLine(input.settings)}`,
    'If this is your trip, send your dates on WhatsApp or comment and I will message you.',
    input.master.terms,
  ])
}

function renderWhatsApp(input: RenderInput) {
  return paragraphs([
    opening(input),
    input.master.offer,
    input.master.priceLabel,
    extraBlock(input),
    input.master.cta,
    'Reply with dates and how many people are travelling.',
    input.master.terms,
  ])
}

function renderEmail(input: RenderInput) {
  const subject = `${input.offer.destination} from ${money(input.offer.priceFrom)} — want me to check dates?`
  return [
    `Subject: ${subject}`,
    '',
    'Hi,',
    '',
    opening(input),
    '',
    input.master.offer,
    `${input.master.priceLabel}.`,
    extraBlock(input),
    '',
    input.master.proof,
    '',
    input.master.cta,
    contactLine(input.settings),
    '',
    input.settings.agentName,
    input.settings.agencyName,
    input.settings.city,
    '',
    input.master.terms,
  ]
    .filter((line) => line !== undefined)
    .join('\n')
}

function renderSite(input: RenderInput) {
  return [input.master.hook, input.offer.blurb].filter(Boolean).join(' ')
}

const RENDER: Record<Channel, (input: RenderInput) => string> = {
  instagram: renderInstagram,
  tiktok: renderTikTok,
  linkedin: renderLinkedIn,
  facebook: renderFacebook,
  whatsapp: renderWhatsApp,
  email: renderEmail,
  site: renderSite,
}

export function renderAll(
  strategyId: StrategyId,
  master: MasterBrief,
  offer: Offer,
  settings: Settings,
  offers: Offer[],
) {
  const input = { strategyId, master, offer, settings, offers }
  const bodies = {} as Record<Channel, string>
  for (const channel of CHANNELS) bodies[channel] = RENDER[channel](input)
  return bodies
}

function emptyChannels() {
  const channels = {} as Record<Channel, ChannelCopy>
  for (const channel of CHANNELS) {
    channels[channel] = { body: '', inSync: true, posted: false }
  }
  return channels
}

export function paintChannels(
  campaign: Campaign,
  settings: Settings,
  offers: Offer[],
  opts?: { rebuildMaster?: boolean; force?: boolean },
): Campaign {
  const offer = offers.find((item) => item.id === campaign.offerId)
  if (!offer) return campaign
  const master =
    opts?.rebuildMaster || !campaign.master?.hook
      ? buildMaster(campaign.strategyId, offer, settings, offers)
      : campaign.master
  const rendered = renderAll(campaign.strategyId, master, offer, settings, offers)
  const channels = {} as Record<Channel, ChannelCopy>
  for (const channel of CHANNELS) {
    const previous = campaign.channels?.[channel]
    if (previous && !previous.inSync && !opts?.force) {
      channels[channel] = previous
    } else {
      channels[channel] = {
        body: rendered[channel],
        inSync: true,
        posted: previous?.posted ?? false,
      }
    }
  }
  return {
    ...campaign,
    master,
    channels,
    masterEdited: opts?.rebuildMaster ? false : campaign.masterEdited,
    title: `${offer.destination} · ${strategyName(campaign.strategyId)}`,
  }
}

export function blankCampaign(opts: {
  offer: Offer
  strategyId: StrategyId
  settings: Settings
  offers: Offer[]
  scheduledFor: string
  status: Campaign['status']
  automationKey: string
}): Campaign {
  const shell: Campaign = {
    id: crypto.randomUUID(),
    offerId: opts.offer.id,
    strategyId: opts.strategyId,
    title: '',
    status: opts.status,
    scheduledFor: opts.scheduledFor,
    automationKey: opts.automationKey,
    masterEdited: false,
    master: { ...EMPTY_BRIEF },
    channels: emptyChannels(),
    createdAt: new Date().toISOString(),
  }
  return paintChannels(shell, opts.settings, opts.offers, { rebuildMaster: true })
}

export function emailParts(body: string) {
  const match = body.match(/^Subject:\s*(.*)\r?\n([\s\S]*)$/)
  if (!match) return { subject: 'Your trip quote', text: body }
  return { subject: match[1].trim(), text: match[2].trim() }
}

export function profileUrl(channel: 'instagram' | 'tiktok' | 'linkedin' | 'facebook', value: string) {
  const fallback = {
    instagram: 'https://www.instagram.com/',
    tiktok: 'https://www.tiktok.com/upload',
    linkedin: 'https://www.linkedin.com/feed/',
    facebook: 'https://www.facebook.com/',
  }[channel]
  const trimmed = value.trim()
  if (!trimmed) return fallback
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const handle = trimmed.replace(/^@/, '')
  if (channel === 'instagram') return `https://instagram.com/${handle}`
  if (channel === 'tiktok') return `https://www.tiktok.com/@${handle}`
  if (channel === 'facebook') return `https://facebook.com/${handle}`
  return `https://www.linkedin.com/in/${handle}`
}

export function waLink(number: string, text: string) {
  const digits = waDigits(number)
  const query = `text=${encodeURIComponent(text)}`
  return digits ? `https://wa.me/${digits}?${query}` : `https://wa.me/?${query}`
}

export function bioMessage(settings: Settings) {
  const agency = settings.agencyName.trim() || 'there'
  return `Hi ${agency}, I want a travel quote. I am travelling from ${settings.city || 'my city'}.`
}

export function bioLink(settings: Settings) {
  const digits = waDigits(settings.whatsapp)
  if (!digits) return ''
  return `https://wa.me/${digits}?text=${encodeURIComponent(bioMessage(settings))}`
}

export function quoteMessage(
  lead: { name: string; from: string; to: string; dates: string; travellers: string; kind: string; notes: string },
  settings: Settings,
) {
  const kind = lead.kind === 'unsure' ? 'trip' : lead.kind
  return [
    `Hi ${settings.agencyName || 'there'}, I am ${lead.name}.`,
    `Please quote a ${kind} to ${lead.to} from ${lead.from || settings.city}.`,
    lead.dates ? `Dates: ${lead.dates}.` : '',
    `Travellers: ${lead.travellers || 'not sure yet'}.`,
    lead.notes.trim(),
  ]
    .filter(Boolean)
    .join(' ')
}

export function followUpsFor(
  lead: { name: string; to: string; dates: string; travellers: string },
  settings: Settings,
): FollowUp[] {
  const name = lead.name.trim() || 'there'
  const place = lead.to.trim() || 'your trip'
  const dates = lead.dates.trim() || 'the dates you mentioned'
  const people = lead.travellers.trim() || 'your group'
  const agency = settings.agencyName.trim() || 'the travel desk'
  return [
    {
      id: crypto.randomUUID(),
      dayLabel: 'Same day · WhatsApp',
      channel: 'whatsapp',
      done: false,
      message: `Hi ${name}, it is ${agency}. Thanks for asking about ${place} on ${dates} for ${people}. I will check a live price and what is included. Is this a holiday, a family trip, or something else?`,
    },
    {
      id: crypto.randomUUID(),
      dayLabel: 'Day 2 · Email',
      channel: 'email',
      done: false,
      message: [
        `Subject: Two ways to do ${place}`,
        '',
        `Hi ${name},`,
        '',
        `I can price ${place} two ways.`,
        'Option A is the packaged trip: flights and hotel together, so the logistics are handled.',
        'Option B is flights only, if you already know where you want to stay.',
        '',
        `Reply with A or B, plus any date flexibility around ${dates}, and I will send one confirmed figure.`,
        '',
        settings.agentName,
        agency,
      ].join('\n'),
    },
    {
      id: crypto.randomUUID(),
      dayLabel: 'Day 5 · WhatsApp',
      channel: 'whatsapp',
      done: false,
      message: `Hi ${name}, checking in on ${place}. If you still want to travel ${dates}, reply and I will send one confirmed option today: the price, what is included, and what is not.`,
    },
  ]
}

export function campaignPack(campaign: Campaign) {
  return CHANNELS.map((channel) => {
    const meta = channel.toUpperCase()
    return `## ${meta}\n${campaign.channels[channel].body}`
  }).join('\n\n---\n\n')
}
