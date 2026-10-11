import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { quoteMessage, waLink } from './copy'
import { money, waDigits } from './format'
import { PALETTES } from './seed'
import { addLead, useDesk } from './store'
import type { Offer, TripKind } from './types'
import { KIND_LABEL } from './types'
import { Field } from './ui'

const FILTERS: { id: TripKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'flight', label: 'Flights' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'tour', label: 'Tours' },
  { id: 'cruise', label: 'Cruises' },
  { id: 'car', label: 'Cars' },
]

type QuoteForm = {
  name: string
  phone: string
  email: string
  from: string
  to: string
  dates: string
  travellers: string
  kind: TripKind | 'unsure'
  notes: string
}

export function Storefront() {
  const desk = useDesk()
  const { settings, offers, campaigns } = desk
  const [filter, setFilter] = useState<TripKind | 'all'>('all')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [form, setForm] = useState<QuoteForm>(() => ({
    name: '',
    phone: '',
    email: '',
    from: settings.city,
    to: '',
    dates: '',
    travellers: '2 adults',
    kind: 'unsure',
    notes: '',
  }))

  const hero = useMemo(() => {
    const live = [...campaigns]
      .filter((campaign) => campaign.status === 'live')
      .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))[0]
    const offer =
      offers.find((item) => item.id === live?.offerId) ?? offers.find((item) => item.featured) ?? offers[0]
    const cluster = offer ? offers.filter((item) => item.destination === offer.destination) : []
    return { live, offer, cluster }
  }, [campaigns, offers])

  const visible = offers.filter((offer) => filter === 'all' || offer.kind === filter)
  const stories = [...campaigns]
    .filter((campaign) => campaign.id !== hero.live?.id)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, 3)

  function set<K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function quoteThis(offer: Offer) {
    setForm((current) => ({
      ...current,
      to: offer.destination,
      from: offer.departFrom || current.from,
      kind: offer.kind,
    }))
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim() || !form.to.trim()) {
      setError('Add your name and where you want to go.')
      setSent('')
      return
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError('Add a phone number or an email so we can reply.')
      setSent('')
      return
    }
    setError('')
    const saved = addLead({ ...form, source: 'Customer page' })
    let webhookNote = ''
    if (settings.leadWebhook.trim()) {
      try {
        await fetch(settings.leadWebhook.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saved),
        })
      } catch {
        webhookNote = ' The webhook did not answer.'
      }
    }
    const text = quoteMessage(form, settings)
    if (waDigits(settings.whatsapp)) {
      window.open(waLink(settings.whatsapp, text), '_blank', 'noopener')
      setSent(`WhatsApp should have opened with your trip filled in. Send the message.${webhookNote}`)
    } else if (settings.email.trim()) {
      window.location.href = `mailto:${settings.email.trim()}?subject=${encodeURIComponent(`Quote for ${form.to}`)}&body=${encodeURIComponent(text)}`
      setSent(`Your email app should have opened.${webhookNote}`)
    } else {
      setSent(`Saved on this computer. Add a WhatsApp number in the agent desk before you share this page.${webhookNote}`)
    }
  }

  const offer = hero.offer

  return (
    <div className="store">
      {settings.preview && (
        <div className="preview-banner">
          Preview mode. These from-prices are samples until you edit them and mark the desk ready to share.
        </div>
      )}
      <header className="top">
        <div className="brand-block">
          <p className="city-line">{settings.city || 'Travel desk'}</p>
          <p className="word">{settings.agencyName}</p>
          <p className="tagline">{settings.tagline}</p>
        </div>
        <nav className="nav">
          <a href="#deals">Offers</a>
          <a href="#how">How it works</a>
          <a href="#journal">This week</a>
          <a href="#quote">Get a quote</a>
          {settings.preview && <a href="#/admin">Agent desk</a>}
        </nav>
      </header>

      {offer ? (
        <section className="hero-wrap">
          <div className="hero">
            <div>
              <p className="stamp">This week</p>
              <h1>{offer.destination}</h1>
              <p className="lede">{hero.live?.channels.site.body || offer.blurb}</p>
              <div className="chips">
                {hero.cluster.map((item) => (
                  <button key={item.id} type="button" className="chip" onClick={() => quoteThis(item)}>
                    <span>{KIND_LABEL[item.kind]}</span>
                    <b>{money(item.priceFrom)}</b>
                    <small>{item.nights}</small>
                  </button>
                ))}
              </div>
              <div className="hero-actions">
                <a className="btn solid" href="#quote">
                  Get a checked quote
                </a>
                {waDigits(settings.whatsapp) && (
                  <a
                    className="btn ghost"
                    href={waLink(settings.whatsapp, `Hi ${settings.agencyName}, I want to ask about ${offer.destination}.`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp us
                  </a>
                )}
              </div>
              <p className="terms">{hero.live?.master.terms}</p>
            </div>
            <aside className="pass">
              <div>
                <p className="kicker">Consultant quote</p>
                <h2>{offer.destination}</h2>
                <p>{offer.country}</p>
                <p>{offer.blurb}</p>
                <p className="includes">{offer.includes}</p>
              </div>
              <div className="stub">
                <span>From</span>
                <strong>{money(offer.priceFrom)}</strong>
                <span>{offer.travelWindow}</span>
                <span>Departs {offer.departFrom}</span>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="panel">
          <h1>Add an offer</h1>
          <p>The customer page is empty until the agent desk has at least one trip.</p>
          <a className="btn sea" href="#/admin">
            Open the agent desk
          </a>
        </section>
      )}

      <section className="quote-panel" id="quote">
        <div>
          <h2>Tell us the trip. We check the fare.</h2>
          <p className="intro">
            This is a quote, not a live flight search. You get a person, a price, and what is included — before you pay.
          </p>
        </div>
        <form onSubmit={onSubmit}>
          <div className="grid-2">
            <Field label="Your name">
              <input value={form.name} onChange={(event) => set('name', event.target.value)} autoComplete="name" />
            </Field>
            <Field label="WhatsApp or phone">
              <input value={form.phone} onChange={(event) => set('phone', event.target.value)} autoComplete="tel" />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Leaving from">
              <input value={form.from} onChange={(event) => set('from', event.target.value)} />
            </Field>
            <Field label="Where to">
              <input value={form.to} onChange={(event) => set('to', event.target.value)} />
            </Field>
            <Field label="When">
              <input
                value={form.dates}
                placeholder="12–20 Dec, or flexible"
                onChange={(event) => set('dates', event.target.value)}
              />
            </Field>
            <Field label="Travellers">
              <input value={form.travellers} onChange={(event) => set('travellers', event.target.value)} />
            </Field>
            <Field label="Trip type">
              <select value={form.kind} onChange={(event) => set('kind', event.target.value as QuoteForm['kind'])}>
                <option value="unsure">Not sure yet</option>
                <option value="flight">Flight</option>
                <option value="holiday">Holiday</option>
                <option value="tour">Tour</option>
                <option value="cruise">Cruise</option>
                <option value="car">Car</option>
              </select>
            </Field>
          </div>
          <Field label="Anything we should know">
            <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} rows={3} />
          </Field>
          {error && <p className="warnline">{error}</p>}
          {sent && <p className="success">{sent}</p>}
          <div className="actions">
            <button className="btn solid" type="submit">
              {waDigits(settings.whatsapp) ? 'WhatsApp this quote' : 'Request a quote'}
            </button>
          </div>
          <p className="fine">
            {waDigits(settings.whatsapp)
              ? 'WhatsApp opens with the trip written out. On this computer the enquiry is also saved for follow-up.'
              : 'This saves the enquiry on this computer. Add a WhatsApp number before you put the page in a bio.'}
          </p>
        </form>
      </section>

      <section id="deals">
        <div className="section-head">
          <h2>Fares and holidays you can quote</h2>
          <div className="filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? 'btn small sea' : 'btn small quiet'}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="cards">
          {visible.map((item) => (
            <article
              key={item.id}
              className="card"
              style={{ background: `linear-gradient(165deg, ${PALETTES[item.palette][0]}, ${PALETTES[item.palette][1]})` }}
            >
              <div>
                <p className="kind">{KIND_LABEL[item.kind]}</p>
                <h3>{item.destination}</h3>
                <p>{item.blurb}</p>
              </div>
              <div>
                <p className="price">{money(item.priceFrom)}</p>
                <p>
                  {item.nights} · {item.departFrom}
                </p>
                <button type="button" className="btn small light" onClick={() => quoteThis(item)}>
                  Quote this
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how">
        <h2>How a booking actually happens</h2>
        <div className="steps">
          <article className="step">
            <span>01</span>
            <h3>You send the dates</h3>
            <p>WhatsApp, email, or the form. Tell us who is going and when you can travel.</p>
          </article>
          <article className="step">
            <span>02</span>
            <h3>We check a live fare</h3>
            <p>You get the price, what is included, and what is not. Nothing is held until you agree.</p>
          </article>
          <article className="step">
            <span>03</span>
            <h3>One person stays on it</h3>
            <p>{settings.trustLine}</p>
          </article>
        </div>
      </section>

      {stories.length > 0 && (
        <section id="journal">
          <h2>The rest of this week</h2>
          <div className="stories">
            {stories.map((campaign) => {
              const linked = offers.find((item) => item.id === campaign.offerId)
              return (
                <article key={campaign.id} className="story">
                  <p className="kicker">{campaign.title}</p>
                  <p>{campaign.master.hook}</p>
                  {linked && (
                    <button type="button" className="btn small quiet" onClick={() => quoteThis(linked)}>
                      Ask about {linked.destination}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      <footer className="footer">
        <div>
          <strong>{settings.agencyName}</strong>
          <p>{settings.bio}</p>
        </div>
        <div className="footer-links">
          {settings.phone.trim() && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
          {settings.email.trim() && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
          {waDigits(settings.whatsapp) && (
            <a href={waLink(settings.whatsapp, `Hi ${settings.agencyName}, I want a travel quote.`)} target="_blank" rel="noreferrer">
              WhatsApp {settings.whatsapp}
            </a>
          )}
          {settings.instagram.trim() && (
            <a href={socialHref('instagram', settings.instagram)} target="_blank" rel="noreferrer">
              Instagram
            </a>
          )}
          {settings.tiktok.trim() && (
            <a href={socialHref('tiktok', settings.tiktok)} target="_blank" rel="noreferrer">
              TikTok
            </a>
          )}
          {settings.linkedin.trim() && (
            <a href={socialHref('linkedin', settings.linkedin)} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          )}
          {settings.facebook.trim() && (
            <a href={socialHref('facebook', settings.facebook)} target="_blank" rel="noreferrer">
              Facebook
            </a>
          )}
          <a href="#/admin">Agent desk</a>
        </div>
      </footer>

      <div className="mobile-contact">
        <a href="#quote">Quote</a>
        {waDigits(settings.whatsapp) ? (
          <a href={waLink(settings.whatsapp, `Hi ${settings.agencyName}, I want a travel quote.`)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        ) : (
          <a href="#quote">Message</a>
        )}
        {settings.phone.trim() ? <a href={`tel:${settings.phone}`}>Call</a> : <a href={`mailto:${settings.email}`}>Email</a>}
      </div>
    </div>
  )
}

function socialHref(channel: 'instagram' | 'tiktok' | 'linkedin' | 'facebook', value: string) {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const handle = trimmed.replace(/^@/, '')
  if (channel === 'instagram') return `https://instagram.com/${handle}`
  if (channel === 'tiktok') return `https://www.tiktok.com/@${handle}`
  if (channel === 'facebook') return `https://facebook.com/${handle}`
  return `https://www.linkedin.com/in/${handle}`
}
