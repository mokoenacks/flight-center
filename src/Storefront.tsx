import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { quoteMessage, waLink } from './copy'
import { money, waDigits } from './format'
import { PALETTES } from './seed'
import { recordView, useRemoteStatus } from './remote'
import { addLead, ensureLeadSaved, useDesk } from './store'
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

type SendChannel = 'whatsapp' | 'email' | 'both'

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
  const remote = useRemoteStatus()
  const { settings, offers, campaigns } = desk
  const [filter, setFilter] = useState<TripKind | 'all'>('all')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [dialog, setDialog] = useState<Offer | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [dialogSent, setDialogSent] = useState('')
  const [dialogForm, setDialogForm] = useState<QuoteForm | null>(null)
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
    setDialog(offer)
    setDialogError('')
    setDialogSent('')
    setDialogForm({
      ...form,
      to: offer.destination,
      from: offer.departFrom || form.from,
      kind: offer.kind,
    })
  }

  function closeDialog() {
    setDialog(null)
    setDialogForm(null)
  }

  useEffect(() => {
    if (!dialog) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDialog()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [dialog])

  async function submitQuote(
    event: FormEvent,
    values: QuoteForm,
    channel: SendChannel,
    report: { setError: (value: string) => void; setSent: (value: string) => void },
  ) {
    event.preventDefault()
    if (!values.name.trim() || !values.to.trim()) {
      report.setError('Add your name and where you want to go.')
      report.setSent('')
      return
    }
    const hasPhone = Boolean(values.phone.trim())
    const hasEmail = Boolean(values.email.trim())
    if (!hasPhone && !hasEmail) {
      report.setError('Add a phone number or an email so we can reply.')
      report.setSent('')
      return
    }
    const sendWhatsapp = hasPhone && (channel === 'whatsapp' || channel === 'both')
    const sendEmail = hasEmail && (channel === 'email' || channel === 'both')
    report.setError('')
    const source =
      sendWhatsapp && sendEmail
        ? 'Customer page · WhatsApp and email'
        : sendEmail
          ? 'Customer page · Email'
          : 'Customer page · WhatsApp'
    const saved = addLead({ ...values, source })
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
    const problem = await ensureLeadSaved(saved, sendEmail)
    if (sendWhatsapp) window.open(waLink(settings.whatsapp, quoteMessage(values, settings)), '_blank', 'noopener')
    if (problem) {
      report.setError(problem)
      if (sendWhatsapp) report.setSent('WhatsApp should have opened with your trip filled in. Send the message.')
      return
    }
    const sentNote = sendWhatsapp && sendEmail
      ? 'WhatsApp should have opened with your trip filled in. Send that message. We also emailed your consultant.'
      : sendEmail
        ? 'We emailed your consultant. They will reply to the address you gave.'
        : 'WhatsApp should have opened with your trip filled in. Send the message.'
    report.setSent(`${sentNote}${webhookNote}`)
  }

  const offer = hero.offer

  useEffect(() => {
    if (!remote.configured || remote.view === 'loading') return
    if (remote.view === 'ready' && desk.agentId) {
      recordView('customer', desk.agentId)
      return
    }
    if (remote.view === 'idle' || remote.view === 'missing') recordView('home')
  }, [remote.configured, remote.view, desk.agentId])

  if (remote.configured && remote.view === 'loading') {
    return (
      <div className="store">
        <main className="gate">
          <h1>Opening this desk…</h1>
        </main>
      </div>
    )
  }

  if (remote.configured && (remote.view === 'idle' || remote.view === 'missing' || !desk.agentId)) {
    return (
      <div className="store">
        <main className="gate">
          <h1>{remote.view === 'missing' ? 'This link is not active' : 'Ask your consultant for their link'}</h1>
          <p className="lede">
            {remote.view === 'missing'
              ? 'That customer page is not linked to a consultant yet.'
              : 'Each consultant has their own page. Open the link they sent you.'}
          </p>
          <p>
            <a href="#/terms">Terms</a>
          </p>
        </main>
      </div>
    )
  }

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
          <a href="#/terms">Terms</a>
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
          <h1>Trips coming soon</h1>
          <p>Send a quote below and we will suggest somewhere that fits.</p>
        </section>
      )}

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

      <section className="quote-panel" id="quote">
        <QuoteFormFields
          form={form}
          onChange={set}
          error={error}
          sent={sent}
          title="Tell us the trip. We check the fare."
          intro="Quote any destination, even one that is not listed above. This is a person checking the fare, before you pay."
          onSubmit={(event, channel) => submitQuote(event, form, channel, { setError, setSent })}
        />
      </section>

      <footer className="footer">
        <div>
          <strong>{settings.agencyName}</strong>
          <p>{settings.bio}</p>
        </div>
        <div className="footer-links">
          <a href="#/terms">Terms</a>
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

      {dialog && dialogForm && (
        <div className="modal-back" onClick={closeDialog}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <QuoteFormFields
              idPrefix="dialog"
              form={dialogForm}
              onChange={(key, value) => setDialogForm((current) => (current ? { ...current, [key]: value } : current))}
              error={dialogError}
              sent={dialogSent}
              title={`Quote ${dialog.destination}`}
              titleId="quote-dialog-title"
              intro={`${KIND_LABEL[dialog.kind]} from ${money(dialog.priceFrom)}. ${dialog.nights}${dialog.departFrom ? ` · leaving ${dialog.departFrom}` : ''}.`}
              onSubmit={(event, channel) =>
                submitQuote(event, dialogForm, channel, { setError: setDialogError, setSent: setDialogSent })
              }
              onClose={closeDialog}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function QuoteFormFields({
  form,
  onChange,
  error,
  sent,
  title,
  intro,
  onSubmit,
  onClose,
  titleId,
  idPrefix = 'page',
}: {
  form: QuoteForm
  onChange: <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => void
  error: string
  sent: string
  title: string
  intro: string
  onSubmit: (event: FormEvent, channel: SendChannel) => void
  onClose?: () => void
  titleId?: string
  idPrefix?: string
}) {
  const hasPhone = Boolean(form.phone.trim())
  const hasEmail = Boolean(form.email.trim())
  return (
    <>
      <div className="modal-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className="intro">{intro}</p>
        </div>
        {onClose && (
          <button type="button" className="btn small quiet" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <form
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
          const picked = submitter?.value
          const channel: SendChannel =
            picked === 'email' || picked === 'both' || picked === 'whatsapp'
              ? picked
              : hasPhone
                ? 'whatsapp'
                : 'email'
          onSubmit(event, channel)
        }}
      >
        <div className="grid-2">
          <Field label="Your name">
            <input
              id={`${idPrefix}-name`}
              value={form.name}
              onChange={(event) => onChange('name', event.target.value)}
              autoComplete="name"
              autoFocus={Boolean(onClose)}
            />
          </Field>
          <Field label="WhatsApp or phone">
            <input
              value={form.phone}
              onChange={(event) => onChange('phone', event.target.value)}
              autoComplete="tel"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange('email', event.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Leaving from">
            <input value={form.from} onChange={(event) => onChange('from', event.target.value)} />
          </Field>
          <Field label="Where to">
            <input value={form.to} onChange={(event) => onChange('to', event.target.value)} />
          </Field>
          <Field label="When">
            <input
              value={form.dates}
              placeholder="12–20 Dec, or flexible"
              onChange={(event) => onChange('dates', event.target.value)}
            />
          </Field>
          <Field label="Travellers">
            <input value={form.travellers} onChange={(event) => onChange('travellers', event.target.value)} />
          </Field>
          <Field label="Trip type">
            <select value={form.kind} onChange={(event) => onChange('kind', event.target.value as QuoteForm['kind'])}>
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
          <textarea value={form.notes} onChange={(event) => onChange('notes', event.target.value)} rows={3} />
        </Field>
        {error && <p className="warnline">{error}</p>}
        {sent && <p className="success">{sent}</p>}
        {hasPhone && hasEmail && <p className="fine">Choose how to send this quote.</p>}
        <div className="actions">
          {hasPhone && (
            <button className="btn solid" type="submit" value="whatsapp">
              Send on WhatsApp
            </button>
          )}
          {hasEmail && (
            <button className={hasPhone ? 'btn sea' : 'btn solid'} type="submit" value="email">
              Send by email
            </button>
          )}
          {hasPhone && hasEmail && (
            <button className="btn quiet" type="submit" value="both">
              Send both
            </button>
          )}
          {!hasPhone && !hasEmail && (
            <button className="btn solid" type="submit" value="whatsapp">
              Request a quote
            </button>
          )}
        </div>
        <p className="fine">
          {hasPhone && hasEmail
            ? 'A number opens WhatsApp. An email is sent to the consultant on this page. Both does each.'
            : hasPhone
              ? 'WhatsApp opens with your trip written out. Send it and we will reply.'
              : hasEmail
                ? 'We email the consultant on this page. They reply to the address you entered.'
                : 'Add a number, an email, or both.'}
        </p>
      </form>
    </>
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
