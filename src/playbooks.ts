import type { StrategyId } from './types'

export type Playbook = {
  id: StrategyId
  name: string
  principle: string
  why: string
  moves: string[]
  guardrail: string
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'price-anchor',
    name: 'Price on the first line',
    principle: 'Say the destination and the from-price before anything else.',
    why: 'People shopping for travel decide in a few seconds whether a trip is in range. Retail sites that convert put the place and the from-price on the first screen, then repeat that same number in the ad.',
    moves: [
      'Pick one fare you can still ticket this week.',
      'Build the campaign with this strategy so every channel opens on that price.',
      'Read Instagram, TikTok, LinkedIn, Facebook, WhatsApp, email, and the customer page. The number must match.',
      'Publish, then mark each channel posted so you know what the public has seen.',
    ],
    guardrail: 'If the fare moves, change the offer price and resync. Do not leave yesterday’s price on one network.',
  },
  {
    id: 'quote-magnet',
    name: 'Quote magnet',
    principle: 'Ask for the enquiry, not the payment.',
    why: 'Most people will not pay from a post. They will ask a person to check. A quote is a smaller yes, and it gives you a WhatsApp conversation while the dates are still real.',
    moves: [
      'Point every post at one action: message you with dates.',
      'Use the same wording on the customer page button and in the first WhatsApp line.',
      'Answer with two options, a tighter one and a more comfortable one.',
      'Log the chat in Leads so the day-2 and day-5 follow-ups are written for you.',
    ],
    guardrail: 'Do not pretend the form searches live airline inventory. You check the fare, then you confirm it.',
  },
  {
    id: 'dream-then-plan',
    name: 'Dream, then the plan',
    principle: 'Open with the feeling. Close with city, dates, and price.',
    why: 'Inspiration earns the save. The departure city, the month, and the from-price earn the message. Posts that only dream get likes. Posts that add a next step get trips.',
    moves: [
      'Use this on the mid-week post, when you are not leading with a discount.',
      'Keep one concrete fact in the second sentence: nights, what is included, or the departure city.',
      'Send the same destination to the customer page, so the bio link matches the post.',
    ],
    guardrail: 'Do not use another country’s tourism slogan or a photo you do not have rights to.',
  },
  {
    id: 'package-ladder',
    name: 'Three ways to go',
    principle: 'One destination. A flight, a holiday, and one extra.',
    why: 'A single price forces a yes or no. Three prices let a client choose a spend. The same pattern is why strong travel homepages show a flight, a packaged holiday, and a tour under one destination.',
    moves: [
      'Create at least two offers for the same destination, with different kinds.',
      'Run this strategy so the ladder is copied into every channel.',
      'On the customer page, the price chips come from those offers. Fix the price there, not inside one caption.',
    ],
    guardrail: 'Only list a rung you can actually quote. Drop a product rather than invent one.',
  },
  {
    id: 'social-proof',
    name: 'Borrow real trust',
    principle: 'Put a true client outcome next to the offer.',
    why: 'Travel is expensive and easy to get wrong. A specific result — where they went, who went, what was included — does more than a star rating you cannot stand behind.',
    moves: [
      'Write one true sentence in Settings, in the trust line.',
      'Resync this campaign so every channel receives it.',
      'Keep the price and the dates in the same post so the story is also an offer.',
    ],
    guardrail: 'Never invent a review, a celebrity client, or a rating. If you do not have a story yet, use another strategy.',
  },
  {
    id: 'seasonal-wave',
    name: 'Sell the dates',
    principle: 'Market the week people already have off.',
    why: 'South African travel demand clumps: school holidays, long weekends, December, mid-year Europe, and cruise planning season. A dated offer beats a mood.',
    moves: [
      'Look at the season card on Today before you pick an offer.',
      'Put the travel window in the first line.',
      'Run one campaign per window. Do not mix Easter and December in the same post.',
    ],
    guardrail: 'If that week is already full, say so and offer the next date. Do not advertise a departure you cannot book.',
  },
  {
    id: 'speed-to-lead',
    name: 'Reply in minutes',
    principle: 'Answer while the fare is still on the screen.',
    why: 'The enquiry you answer today books more often than the one you answer tomorrow. WhatsApp is the fastest channel for a South African client, so the other networks should point there.',
    moves: [
      'Put your WhatsApp bio link on Instagram, TikTok, Facebook, and LinkedIn.',
      'When a message arrives, log it under Leads. The same-day reply is already written.',
      'Send the day-2 email and the day-5 note. Most trips need more than one touch.',
    ],
    guardrail: 'Do not write “seats are almost gone” unless you have checked. The follow-up asks if they still want the trip. It does not invent scarcity.',
  },
]

export function strategyName(id: StrategyId) {
  return PLAYBOOKS.find((playbook) => playbook.id === id)?.name ?? id
}

const SEASONS: { title: string; detail: string }[] = [
  {
    title: 'Use the quiet month',
    detail:
      'December demand has eased. Quote people who postponed, and start Valentine’s weekends plus Easter deposits.',
  },
  {
    title: 'Valentine’s and cruise planning',
    detail:
      'Short-haul beach weekends book now. This is also when many people plan a cruise for later in the year. Sell a date, not a vague dream.',
  },
  {
    title: 'Easter money is already moving',
    detail:
      'Families lock Easter in March. Put a beach holiday and a Cape break in front of them with a from-price you have checked.',
  },
  {
    title: 'Travel the holiday, then pivot',
    detail:
      'During Easter week, reply faster instead of launching five new offers. The week after, start June school holidays and Europe summer deposits.',
  },
  {
    title: 'Sell summer departures while seats exist',
    detail:
      'May is when July trips are still buildable. Ask for a date conversation now, not a someday.',
  },
  {
    title: 'School holidays are the product',
    detail:
      'People already have the days off. Lead with the departure date and what is included. Local breaks and overseas trips compete in the same inbox.',
  },
  {
    title: 'Sell only what you can confirm',
    detail:
      'This is peak holiday. Stop advertising a fare you cannot hold today. Quote add-ons for clients already travelling, and note who wants December.',
  },
  {
    title: 'Open the December file',
    detail:
      'August is when summer budgets get discussed. Start beach holidays and cruises with from-prices you have checked this week.',
  },
  {
    title: 'One break, then festive',
    detail:
      'There is a spring school break, then a rush for December. Run one offer for the break and a different offer for December. Do not mix the dates.',
  },
  {
    title: 'Exams, then summer seats',
    detail:
      'Households are in exam season, then they want sun. Quote December and early January clearly. Take next year’s cruise enquiries without burying the summer offer.',
  },
  {
    title: 'Only advertise a fare you can hold',
    detail:
      'November sale posts go stale in hours. Put the expiry in the same sentence as the price, and answer WhatsApp while the post is up.',
  },
  {
    title: 'Deliver, then ask for the next trip',
    detail:
      'This month is service. Ask booked clients for one referral, and write down who said they would travel in January or at Easter.',
  },
]

export function seasonTip(date = new Date()) {
  return SEASONS[date.getMonth()]
}
