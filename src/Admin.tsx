import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  bioLink,
  campaignPack,
  emailParts,
  profileUrl,
  waLink,
} from './copy'
import { addDays, isoDate, money, planMonday, prettyDate, prettyWhen, samePrice, waDigits } from './format'
import { PLAYBOOKS, seasonTip, strategyName } from './playbooks'
import {
  loadViewReport,
  saveNewPassword,
  sendPasswordReset,
  signInDesk,
  signOutDesk,
  signUpDesk,
  useRemoteStatus,
  type ViewReport,
} from './remote'
import { DEFAULT_TRUST, PALETTES } from './seed'
import {
  addLead,
  commit,
  deleteCampaign,
  deleteLead,
  deleteOffer,
  draftFromPlaybook,
  isDeskState,
  patchCampaign,
  patchLead,
  resync,
  resetDemo,
  runWeek,
  saveOffer,
  saveSettings,
  toggleFollowUp,
  togglePosted,
  updateChannel,
  updateMaster,
  retarget,
  useDesk,
} from './store'
import type { Campaign, Channel, Lead, LeadStage, Offer, Palette, Settings, StrategyId, TripKind } from './types'
import { CHANNELS, CHANNEL_META, KIND_LABEL } from './types'
import { PriceBoard } from './Feed'
import { CopyButton, Field } from './ui'

type Tab = 'today' | 'bids' | 'offers' | 'campaigns' | 'leads' | 'playbooks' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'bids', label: 'Prices' },
  { id: 'offers', label: 'Offers' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'leads', label: 'Leads' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'settings', label: 'Contacts' },
]

export function Admin() {
  const desk = useDesk()
  const remote = useRemoteStatus()
  const [tab, setTab] = useState<Tab>('today')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [flash, setFlash] = useState('')
  const newLeads = desk.leads.filter((lead) => lead.stage === 'new').length

  if (remote.configured && !remote.ready) {
    return (
      <div className="desk">
        <main className="workspace">
          <h1 className="page-title">FlightAngel</h1>
          <p className="intro">Opening the database…</p>
        </main>
      </div>
    )
  }

  if (remote.configured && remote.recovery) return <ResetPassword email={remote.email} />
  if (remote.configured && !remote.signedIn) return <SignIn />

  function openCampaign(id: string) {
    setCampaignId(id)
    setTab('campaigns')
  }

  return (
    <div className="desk">
      <aside className="rail">
        <div className="mark">
          <strong>FlightAngel</strong>
          <em>Sell the week</em>
        </div>
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>
            {item.label}
            {item.id === 'leads' && newLeads > 0 ? ` (${newLeads})` : ''}
          </button>
        ))}
        <div className="rail-foot">
          <a className="rail-link" href={desk.slug ? `#/a/${desk.slug}` : '#/admin'}>
            View customer page
          </a>
          {remote.signedIn && (
            <button type="button" onClick={() => void signOutDesk()}>
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main className="workspace">
        {!remote.configured && (
          <p className="warnline">
            Database not connected yet. Run supabase/schema.sql in the Supabase SQL editor, put the URL and anon key in
            .env, then restart.
          </p>
        )}
        {remote.configured && remote.signedIn && desk.slug && (
          <p className="fine">Signed in{remote.email ? ` as ${remote.email}` : ''}. This account has its own page and campaigns.</p>
        )}
        {remote.signedIn && !desk.slug && (
          <p className="warnline">
            Run supabase/multi-agent.sql in the Supabase SQL editor, then refresh. That gives every consultant their own
            link and keeps their campaigns separate.
          </p>
        )}
        {remote.error && <p className="warnline">{remote.error}</p>}
        {tab === 'today' && <Today flash={flash} setFlash={setFlash} onOpen={openCampaign} />}
        {tab === 'bids' && (
          <div>
            <h1 className="page-title">Prices</h1>
            <p className="intro">Open trips are on the board. Post a price. The next price on a trip has to be lower than the lowest one already there.</p>
            <PriceBoard canBid />
          </div>
        )}
        {tab === 'offers' && <Offers />}
        {tab === 'campaigns' && <Campaigns campaignId={campaignId} setCampaignId={setCampaignId} />}
        {tab === 'leads' && <Leads />}
        {tab === 'playbooks' && <Playbooks onOpen={openCampaign} />}
        {tab === 'settings' && <Contacts />}
      </main>
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'signin' | 'create' | 'forgot'>('signin')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSent('')
    if (mode === 'forgot') {
      const problem = await sendPasswordReset(email)
      setBusy(false)
      if (problem) setError(problem)
      else setSent('Check that inbox. The email has a link to choose a new password.')
      return
    }
    const problem = mode === 'create' ? await signUpDesk(email, password) : await signInDesk(email, password)
    setBusy(false)
    if (problem) setError(problem)
  }

  const intro =
    mode === 'create'
      ? 'Create your FlightAngel account. Each consultant gets their own customer link and their own campaigns. Quote emails come to the address you use here.'
      : mode === 'forgot'
        ? 'Reset your FlightAngel password. We email a link to the address on the account, and it opens here so you can choose a new password.'
        : 'Sign in to FlightAngel for your customer link. Quotes sent by email also arrive in your inbox.'

  return (
    <div className="desk">
      <main className="workspace">
        <h1 className="page-title">FlightAngel</h1>
        <p className="intro">{intro}</p>
        <form className="panel signin" onSubmit={submit}>
          <Field label="Email">
            <input type="email" value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} />
          </Field>
          {mode !== 'forgot' && (
            <Field label="Password">
              <input
                type="password"
                value={password}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          )}
          {error && <p className="warnline">{error}</p>}
          {sent && <p className="fine">{sent}</p>}
          <div className="actions">
            <button className="btn sea" type="submit" disabled={busy || !email.trim() || (mode !== 'forgot' && !password)}>
              {busy ? 'Please wait…' : mode === 'create' ? 'Create account' : mode === 'forgot' ? 'Email me a reset link' : 'Sign in'}
            </button>
            {mode === 'signin' && (
              <button
                className="btn quiet"
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError('')
                  setSent('')
                }}
              >
                Forgot password
              </button>
            )}
            <button
              className="btn quiet"
              type="button"
              onClick={() => {
                setMode(mode === 'create' ? 'signin' : mode === 'forgot' ? 'signin' : 'create')
                setError('')
                setSent('')
              }}
            >
              {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export function ResetPassword({ email }: { email: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('Type the same password in both boxes.')
      return
    }
    setBusy(true)
    setError('')
    const problem = await saveNewPassword(password)
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <div className="desk">
      <main className="workspace">
        <h1 className="page-title">Choose a new password</h1>
        <p className="intro">
          {email ? `This reset is for ${email}. ` : ''}
          After you save it, FlightAngel opens with the new password.
        </p>
        <form className="panel signin" onSubmit={submit}>
          <Field label="New password">
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Repeat the password">
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          {error && <p className="warnline">{error}</p>}
          <div className="actions">
            <button className="btn sea" type="submit" disabled={busy || password.length < 6 || !confirm}>
              {busy ? 'Please wait…' : 'Save password'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

function VisitorReport() {
  const remote = useRemoteStatus()
  const [report, setReport] = useState<ViewReport | null | undefined>(undefined)

  useEffect(() => {
    if (!remote.signedIn) return
    let live = true
    void loadViewReport().then((next) => {
      if (live) setReport(next)
    })
    return () => {
      live = false
    }
  }, [remote.signedIn])

  return (
    <section className="panel">
      <h2>Website visits</h2>
      <p>
        Your page counts people who open your customer link. The opening page and the terms page are counted for the
        whole website. A refresh does not add another visit. These numbers stay after you host the site on Render.
      </p>
      {!remote.configured && (
        <p className="warnline">Connect Supabase to start the count. The report reads from that database.</p>
      )}
      {remote.configured && report === undefined && <p>Counting…</p>}
      {remote.configured && report === null && (
        <p className="warnline">Run supabase/views.sql in the Supabase SQL editor, then refresh.</p>
      )}
      {report && (
        <>
          <div className="stats">
            <article className="stat">
              <b>{report.pageViews}</b>
              <span>Views of your page</span>
            </article>
            <article className="stat">
              <b>{report.pageVisitors}</b>
              <span>Visitors on your page</span>
            </article>
            <article className="stat">
              <b>{report.homeViews + report.termsViews}</b>
              <span>Opening page and terms</span>
            </article>
          </div>
          <div className="view-days">
            {report.days.map((day) => (
              <div key={day.day}>
                <b>{day.views}</b>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Today({
  flash,
  setFlash,
  onOpen,
}: {
  flash: string
  setFlash: (value: string) => void
  onOpen: (id: string) => void
}) {
  const desk = useDesk()
  const { settings, campaigns, leads } = desk
  const season = seasonTip()
  const monday = planMonday()
  const week = isoDate(monday)
  const posts = campaigns
    .filter((campaign) => campaign.automationKey.startsWith(`${week}:`))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
  const synced = campaigns.filter((campaign) => CHANNELS.every((channel) => campaign.channels[channel]?.inSync)).length
  const link = bioLink(settings)
  const canShare = Boolean(waDigits(settings.whatsapp) || settings.email.trim())

  return (
    <div>
      <h1 className="page-title">Today</h1>
      <p className="intro">
        Monday shows three prices, Wednesday tells the story, Friday asks for the quote, and Sunday is a WhatsApp
        reminder. Four posts, then spend the time replying.
      </p>
      {flash && <p className="flash">{flash}</p>}
      <div className="stats">
        <article className="stat">
          <b>{leads.filter((lead) => lead.stage === 'new').length}</b>
          <span>New leads</span>
        </article>
        <article className="stat">
          <b>{posts.length}</b>
          <span>Posts this week</span>
        </article>
        <article className="stat">
          <b>{synced}</b>
          <span>Campaigns fully in sync</span>
        </article>
      </div>

      <section className="panel season">
        <p className="kicker">This month</p>
        <h2>{season.title}</h2>
        <p>{season.detail}</p>
      </section>

      <section className="panel">
        <h2>Your customer page</h2>
        <p>This link shows only your offers and your campaigns. Quotes from it are saved here, and email quotes are also sent to your inbox.</p>
        {settings.slug ? (
          <div className="actions">
            <code className="linkbox">{`${window.location.origin}${window.location.pathname}#/a/${settings.slug}`}</code>
            <CopyButton text={`${window.location.origin}${window.location.pathname}#/a/${settings.slug}`} label="Copy page link" />
          </div>
        ) : (
          <p className="warnline">Save a link name under Contacts. That becomes your customer page.</p>
        )}
      </section>

      <VisitorReport />

      <section className="panel">
        <h2>Share one link</h2>
        <p>
          Put this WhatsApp link in your Instagram, TikTok, Facebook, and LinkedIn bios. People message you from their
          own phones. FlightAngel does not log into those apps.
        </p>
        {link ? (
          <div className="actions">
            <code className="linkbox">{link}</code>
            <CopyButton text={link} label="Copy bio link" />
          </div>
        ) : (
          <p className="warnline">Add a WhatsApp number under Contacts. That link is the one that gets you business.</p>
        )}
        <div className="checklist">
          <Check on={Boolean(waDigits(settings.whatsapp))} label="WhatsApp Business number" />
          <Check on={Boolean(settings.email.trim())} label="Email" />
          <Check on={Boolean(settings.phone.trim())} label="Phone" />
          <Check on={!settings.preview} label="Sample-price warning removed" />
        </div>
        {settings.preview && (
          <button
            type="button"
            className="btn sea"
            disabled={!canShare}
            onClick={() => saveSettings({ ...settings, preview: false })}
          >
            {canShare ? 'Mark ready to share' : 'Add WhatsApp or email first'}
          </button>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>
            {prettyDate(week)} – {prettyDate(isoDate(addDays(monday, 6)))}
          </h2>
          <button
            type="button"
            className="btn sea"
            onClick={() => {
              runWeek()
              setFlash('This week is rebuilt. Posts still in sync were rewritten. Hand-edited posts were kept.')
            }}
          >
            Build this week’s posts
          </button>
        </div>
        <div className="clist">
          {posts.map((campaign) => (
            <button key={campaign.id} type="button" className="item" onClick={() => onOpen(campaign.id)}>
              <strong>{prettyDate(campaign.scheduledFor)}</strong>
              <span>{campaign.title}</span>
              <Status campaign={campaign} />
            </button>
          ))}
          {posts.length === 0 && <p>No posts for this week yet. Build them from your current offers.</p>}
        </div>
      </section>

      <section className="panel">
        <h2>New enquiries</h2>
        {leads.filter((lead) => lead.stage === 'new').length === 0 && (
          <p>None waiting. Log a WhatsApp chat under Leads and the three follow-ups are written for you.</p>
        )}
        <div className="clist">
          {leads
            .filter((lead) => lead.stage === 'new')
            .slice(0, 4)
            .map((lead) => (
              <article key={lead.id} className="item static">
                <strong>{lead.name}</strong>
                <span>
                  {lead.to || 'Trip not set'} · {prettyWhen(lead.createdAt)}
                </span>
              </article>
            ))}
        </div>
      </section>
    </div>
  )
}

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <p className={on ? 'check ok' : 'check'}>
      <span>{on ? 'Ready' : 'Missing'}</span>
      {label}
    </p>
  )
}

function Status({ campaign }: { campaign: Campaign }) {
  const custom = CHANNELS.filter((channel) => campaign.channels[channel] && !campaign.channels[channel].inSync).length
  const posted = CHANNELS.filter((channel) => campaign.channels[channel]?.posted).length
  return (
    <span className="pills">
      <em className={campaign.status === 'live' ? 'pill live' : 'pill muted'}>{campaign.status}</em>
      <em className={custom ? 'pill warn' : 'pill good'}>{custom ? `${custom} hand-edited` : 'In sync'}</em>
      <em className="pill muted">
        {posted}/{CHANNELS.length} posted
      </em>
    </span>
  )
}

function Offers() {
  const desk = useDesk()
  const [offerId, setOfferId] = useState<string | null>(desk.offers[0]?.id ?? null)
  const [draft, setDraft] = useState<Offer | null>(desk.offers[0] ?? null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const offer = desk.offers.find((item) => item.id === offerId)
    if (offer) setDraft(offer)
  }, [offerId, desk.offers])

  function create() {
    const offer: Offer = {
      id: crypto.randomUUID(),
      destination: '',
      country: '',
      kind: 'holiday',
      priceFrom: 0,
      nights: '',
      blurb: '',
      includes: '',
      departFrom: desk.settings.city,
      travelWindow: '',
      featured: false,
      palette: 'lagoon',
    }
    setOfferId(offer.id)
    setDraft(offer)
    setMessage('')
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    if (!draft.destination.trim() || !draft.blurb.trim() || draft.priceFrom <= 0) {
      setMessage('Add a destination, a short description, and a from-price above zero.')
      return
    }
    saveOffer(draft)
    setMessage('Offer saved. Campaigns still in sync were rewritten from it.')
  }

  return (
    <div>
      <div className="section-head">
        <h1 className="page-title">Offers</h1>
        <button type="button" className="btn sea" onClick={create}>
          New offer
        </button>
      </div>
      <p className="intro">
        The customer page and every in-sync post read these prices. Change a fare here, not inside a single caption.
      </p>
      <div className="split">
        <div className="clist">
          {desk.offers.map((offer) => (
            <button
              key={offer.id}
              type="button"
              className={offer.id === offerId ? 'item on' : 'item'}
              onClick={() => setOfferId(offer.id)}
            >
              <strong>{offer.destination || 'Untitled'}</strong>
              <span>
                {KIND_LABEL[offer.kind]} · {money(offer.priceFrom)}
              </span>
            </button>
          ))}
        </div>
        {draft && (
          <form className="panel" onSubmit={save}>
            <div className="grid-2">
              <Field label="Destination">
                <input
                  value={draft.destination}
                  onChange={(event) => setDraft({ ...draft, destination: event.target.value })}
                />
              </Field>
              <Field label="Country">
                <input value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} />
              </Field>
              <Field label="Kind">
                <select
                  value={draft.kind}
                  onChange={(event) => setDraft({ ...draft, kind: event.target.value as TripKind })}
                >
                  {Object.entries(KIND_LABEL).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From-price per person (R)">
                <input
                  type="number"
                  min={0}
                  value={draft.priceFrom || ''}
                  onChange={(event) => setDraft({ ...draft, priceFrom: Number(event.target.value) })}
                />
              </Field>
              <Field label="Nights or duration">
                <input value={draft.nights} onChange={(event) => setDraft({ ...draft, nights: event.target.value })} />
              </Field>
              <Field label="Departs">
                <input
                  value={draft.departFrom}
                  onChange={(event) => setDraft({ ...draft, departFrom: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Travel window">
              <input
                value={draft.travelWindow}
                onChange={(event) => setDraft({ ...draft, travelWindow: event.target.value })}
              />
            </Field>
            <Field label="Short description">
              <textarea value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} />
            </Field>
            <Field label="What is included">
              <textarea
                value={draft.includes}
                onChange={(event) => setDraft({ ...draft, includes: event.target.value })}
              />
            </Field>
            <Field label="Card colour">
              <select
                value={draft.palette}
                onChange={(event) => setDraft({ ...draft, palette: event.target.value as Palette })}
              >
                {Object.keys(PALETTES).map((palette) => (
                  <option key={palette} value={palette}>
                    {palette}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(event) => setDraft({ ...draft, featured: event.target.checked })}
              />
              Feature this on the customer page
            </label>
            {message && <p className="success">{message}</p>}
            <div className="actions">
              <button className="btn sea" type="submit">
                Save offer
              </button>
              {desk.offers.some((offer) => offer.id === draft.id) && (
                <button
                  type="button"
                  className="btn quiet"
                  onClick={() => {
                    if (window.confirm('Remove this offer? Posts already written will stay, without this price.')) {
                      deleteOffer(draft.id)
                      setOfferId(desk.offers.find((offer) => offer.id !== draft.id)?.id ?? null)
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Campaigns({
  campaignId,
  setCampaignId,
}: {
  campaignId: string | null
  setCampaignId: (id: string | null) => void
}) {
  const desk = useDesk()
  const campaign = desk.campaigns.find((item) => item.id === campaignId) ?? desk.campaigns[0]

  useEffect(() => {
    if (!campaignId && desk.campaigns[0]) setCampaignId(desk.campaigns[0].id)
  }, [campaignId, desk.campaigns, setCampaignId])

  const grouped = useMemo(() => {
    return [...desk.campaigns].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.title.localeCompare(b.title))
  }, [desk.campaigns])

  return (
    <div>
      <h1 className="page-title">Campaigns</h1>
      <p className="intro">
        One brief feeds Instagram, TikTok, LinkedIn, Facebook, WhatsApp, email, and the customer page. In sync means the
        words match. You still post each one yourself.
      </p>
      <div className="split wide">
        <div className="clist">
          {grouped.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === campaign?.id ? 'item on' : 'item'}
              onClick={() => setCampaignId(item.id)}
            >
              <strong>{prettyDate(item.scheduledFor)}</strong>
              <span>{item.title}</span>
              <Status campaign={item} />
            </button>
          ))}
        </div>
        {campaign ? <Editor campaign={campaign} /> : <p>Build a week from Today, or start from a playbook.</p>}
      </div>
    </div>
  )
}

function Editor({ campaign }: { campaign: Campaign }) {
  const desk = useDesk()
  const offer = desk.offers.find((item) => item.id === campaign.offerId)
  const custom = CHANNELS.filter((channel) => campaign.channels[channel] && !campaign.channels[channel].inSync).length

  function brief<K extends keyof Campaign['master']>(key: K, value: Campaign['master'][K]) {
    updateMaster(campaign.id, { ...campaign.master, [key]: value })
  }

  function download() {
    const blob = new Blob([campaignPack(campaign)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${campaign.title.replace(/[^\w]+/g, '-').toLowerCase() || 'campaign'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  function openChannel(channel: Channel, body: string) {
    if (channel === 'site') {
      window.location.hash = desk.slug ? `#/a/${desk.slug}` : '#/'
      return
    }
    if (channel === 'whatsapp') {
      window.open(waLink('', body), '_blank', 'noopener')
      return
    }
    if (channel === 'email') {
      const parts = emailParts(body)
      window.location.href = `mailto:?subject=${encodeURIComponent(parts.subject)}&body=${encodeURIComponent(parts.text)}`
      return
    }
    window.open(profileUrl(channel, desk.settings[channel]), '_blank', 'noopener')
  }

  return (
    <div className="stack">
      <div className="panel">
        <div className="grid-2">
          <Field label="Offer">
            <select
              value={campaign.offerId}
              onChange={(event) => retarget(campaign.id, campaign.strategyId, event.target.value)}
            >
              {desk.offers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.destination} · {KIND_LABEL[item.kind]} · {money(item.priceFrom)}
                </option>
              ))}
              {!offer && <option value={campaign.offerId}>Offer removed</option>}
            </select>
          </Field>
          <Field label="Strategy">
            <select
              value={campaign.strategyId}
              onChange={(event) => retarget(campaign.id, event.target.value as StrategyId, campaign.offerId)}
            >
              {PLAYBOOKS.map((playbook) => (
                <option key={playbook.id} value={playbook.id}>
                  {playbook.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Publish date">
            <input
              type="date"
              value={campaign.scheduledFor}
              onChange={(event) => patchCampaign(campaign.id, { scheduledFor: event.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              value={campaign.status}
              onChange={(event) => patchCampaign(campaign.id, { status: event.target.value as Campaign['status'] })}
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready to post</option>
              <option value="live">Live on the customer page</option>
            </select>
          </Field>
        </div>
        <p className={custom ? 'warnline' : 'fine'}>
          {custom
            ? `${custom} channel${custom === 1 ? '' : 's'} hand-edited. Master changes will not overwrite them until you resync.`
            : 'All seven channels match this brief.'}
        </p>
        {offer && !samePrice(campaign.master.priceLabel, offer.priceFrom) && (
          <p className="warnline">
            The brief price does not match the offer ({money(offer.priceFrom)}). Update the offer, then resync.
          </p>
        )}
        {!desk.settings.preview && campaign.master.terms.toLowerCase().includes('sample') && (
          <p className="warnline">This brief still calls the price a sample. Resync before you publish it.</p>
        )}
        {campaign.strategyId === 'social-proof' && desk.settings.trustLine === DEFAULT_TRUST && (
          <p className="warnline">
            This still uses the default trust line. Write a real client outcome under Contacts, then resync.
          </p>
        )}
        <div className="grid-2">
          <Field label="Opening line">
            <textarea value={campaign.master.hook} onChange={(event) => brief('hook', event.target.value)} />
          </Field>
          <Field label="What they get">
            <textarea value={campaign.master.offer} onChange={(event) => brief('offer', event.target.value)} />
          </Field>
          <Field label="Price line">
            <input value={campaign.master.priceLabel} onChange={(event) => brief('priceLabel', event.target.value)} />
          </Field>
          <Field label="Call to action">
            <input value={campaign.master.cta} onChange={(event) => brief('cta', event.target.value)} />
          </Field>
        </div>
        <Field label="Trust line used in this brief">
          <textarea value={campaign.master.proof} onChange={(event) => brief('proof', event.target.value)} />
        </Field>
        <Field label="Terms">
          <textarea value={campaign.master.terms} onChange={(event) => brief('terms', event.target.value)} />
        </Field>
        <div className="actions">
          <button type="button" className="btn sea" onClick={() => resync(campaign.id)}>
            Resync every channel
          </button>
          <CopyButton text={campaignPack(campaign)} label="Copy all channels" />
          <button type="button" className="btn quiet" onClick={download}>
            Download pack
          </button>
          <button
            type="button"
            className="btn quiet"
            onClick={() => {
              if (window.confirm('Delete this campaign?')) deleteCampaign(campaign.id)
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="channels">
        {CHANNELS.map((channel) => {
          const copy = campaign.channels[channel]
          if (!copy) return null
          return (
            <article key={channel} className="channel">
              <header>
                <div>
                  <strong>{CHANNEL_META[channel].label}</strong>
                  <p>{CHANNEL_META[channel].hint}</p>
                </div>
                <span className={copy.inSync ? 'pill good' : 'pill warn'}>{copy.inSync ? 'In sync' : 'Hand-edited'}</span>
              </header>
              <textarea value={copy.body} onChange={(event) => updateChannel(campaign.id, channel, event.target.value)} />
              <div className="actions">
                <CopyButton text={copy.body} />
                <button type="button" className="btn small quiet" onClick={() => openChannel(channel, copy.body)}>
                  {channel === 'site' ? 'View page' : channel === 'email' ? 'Open email' : `Open ${CHANNEL_META[channel].label}`}
                </button>
                {!copy.inSync && (
                  <button type="button" className="btn small quiet" onClick={() => resync(campaign.id, channel)}>
                    Resync this one
                  </button>
                )}
                <button type="button" className="btn small quiet" onClick={() => togglePosted(campaign.id, channel)}>
                  {copy.posted ? 'Posted' : 'Mark posted'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Leads() {
  const desk = useDesk()
  const [selected, setSelected] = useState<string | null>(desk.leads[0]?.id ?? null)
  const lead = desk.leads.find((item) => item.id === selected) ?? null

  return (
    <div>
      <h1 className="page-title">Leads</h1>
      <p className="intro">
        A form filled in on someone else’s phone cannot land on this computer. Log the WhatsApp, comment, or call here.
        Three follow-ups are written, and they do not invent scarce seats.
      </p>
      <LogLead
        city={desk.settings.city}
        onCreate={(id) => setSelected(id)}
      />
      <div className="split wide">
        <div className="clist">
          {desk.leads.length === 0 && <p>No leads yet.</p>}
          {desk.leads.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === lead?.id ? 'item on' : 'item'}
              onClick={() => setSelected(item.id)}
            >
              <strong>{item.name}</strong>
              <span>
                {item.to || 'Destination not set'} · {item.stage}
              </span>
            </button>
          ))}
        </div>
        {lead && <LeadCard lead={lead} />}
      </div>
    </div>
  )
}

function LogLead({ city, onCreate }: { city: string; onCreate: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    from: city,
    to: '',
    dates: '',
    travellers: '2 adults',
    kind: 'unsure' as Lead['kind'],
    notes: '',
    source: 'WhatsApp',
  })

  function save(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    const created = addLead(form)
    onCreate(created.id)
    setOpen(false)
    setForm({ ...form, name: '', phone: '', email: '', to: '', dates: '', notes: '' })
  }

  if (!open) {
    return (
      <button type="button" className="btn sea" onClick={() => setOpen(true)}>
        Log a lead
      </button>
    )
  }

  return (
    <form className="panel" onSubmit={save}>
      <div className="grid-2">
        <Field label="Name">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="Came from">
          <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
            {['WhatsApp', 'Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'Phone', 'Email', 'Customer page', 'Walk-in'].map(
              (source) => (
                <option key={source}>{source}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="From">
          <input value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} />
        </Field>
        <Field label="To">
          <input value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} />
        </Field>
        <Field label="Dates">
          <input value={form.dates} onChange={(event) => setForm({ ...form, dates: event.target.value })} />
        </Field>
        <Field label="Travellers">
          <input value={form.travellers} onChange={(event) => setForm({ ...form, travellers: event.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
      <div className="actions">
        <button className="btn sea" type="submit">
          Save lead
        </button>
        <button type="button" className="btn quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function LeadCard({ lead }: { lead: Lead }) {
  const stages: LeadStage[] = ['new', 'contacted', 'quoted', 'booked', 'lost']
  return (
    <article className="panel stack">
      <div>
        <h2>{lead.name}</h2>
        <p className="fine">
          {lead.source} · {prettyWhen(lead.createdAt)}
        </p>
      </div>
      <div className="actions">
        {stages.map((stage) => (
          <button
            key={stage}
            type="button"
            className={lead.stage === stage ? 'btn small sea' : 'btn small quiet'}
            onClick={() => patchLead(lead.id, { stage })}
          >
            {stage}
          </button>
        ))}
      </div>
      <p>
        {lead.from || '—'} to {lead.to || '—'} · {lead.dates || 'dates not set'} · {lead.travellers}
      </p>
      <p>
        {lead.phone} {lead.email}
      </p>
      <Field label="Notes">
        <textarea value={lead.notes} onChange={(event) => patchLead(lead.id, { notes: event.target.value })} />
      </Field>
      <div className="stack">
        {lead.followUps.map((item) => (
          <article key={item.id} className="channel">
            <header>
              <strong>{item.dayLabel}</strong>
              <span className={item.done ? 'pill good' : 'pill muted'}>{item.done ? 'Sent' : 'Waiting'}</span>
            </header>
            <pre>{item.message}</pre>
            <div className="actions">
              <CopyButton text={item.channel === 'email' ? emailParts(item.message).text : item.message} />
              <button
                type="button"
                className="btn small quiet"
                onClick={() => {
                  if (item.channel === 'whatsapp') window.open(waLink(lead.phone, item.message), '_blank', 'noopener')
                  else {
                    const parts = emailParts(item.message)
                    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(parts.subject)}&body=${encodeURIComponent(parts.text)}`
                  }
                }}
              >
                {item.channel === 'whatsapp' ? 'Open WhatsApp' : 'Open email'}
              </button>
              <button type="button" className="btn small quiet" onClick={() => toggleFollowUp(lead.id, item.id)}>
                {item.done ? 'Mark unsent' : 'Mark sent'}
              </button>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        className="btn quiet"
        onClick={() => {
          if (window.confirm('Delete this lead?')) deleteLead(lead.id)
        }}
      >
        Delete lead
      </button>
    </article>
  )
}

function Playbooks({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div>
      <h1 className="page-title">Playbooks</h1>
      <p className="intro">
        These are the moves that get travel enquiries: a clear price, an easy quote, a true story, and a fast reply.
        Each one can draft a campaign from your first featured offer.
      </p>
      <div className="playbooks">
        {PLAYBOOKS.map((playbook) => (
          <article key={playbook.id} className="panel">
            <p className="kicker">{strategyName(playbook.id)}</p>
            <h2>{playbook.principle}</h2>
            <p>{playbook.why}</p>
            <ol>
              {playbook.moves.map((move) => (
                <li key={move}>{move}</li>
              ))}
            </ol>
            <p className="warnline">{playbook.guardrail}</p>
            <button
              type="button"
              className="btn sea"
              onClick={() => {
                const id = draftFromPlaybook(playbook.id)
                if (id) onOpen(id)
              }}
            >
              Draft a campaign
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

function Contacts() {
  const desk = useDesk()
  const [draft, setDraft] = useState<Settings>(desk.settings)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraft(desk.settings)
  }, [desk.settings])

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function save(event: FormEvent) {
    event.preventDefault()
    const slug = draft.slug.trim().toLowerCase()
    if (!/^[a-z0-9-]{3,40}$/.test(slug) || slug === 'admin' || slug === 'a') {
      setMessage('Use a link name of 3 to 40 letters, numbers, or dashes.')
      return
    }
    saveSettings({ ...draft, slug })
    setMessage('Saved. Your customer page and in-sync posts now use these details. Email quotes come to this inbox.')
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(desk, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'flightangel-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 className="page-title">Contacts</h1>
      <p className="intro">
        The customer page, the bio link, and every in-sync post use this one set of details. Handles can be @name or a
        full profile URL.
      </p>
      <form className="panel" onSubmit={save}>
        <div className="grid-2">
          <Field label="Link name">
            <input
              value={draft.slug}
              placeholder="jane"
              onChange={(event) => set('slug', event.target.value.toLowerCase())}
            />
          </Field>
          <Field label="Agency name">
            <input value={draft.agencyName} onChange={(event) => set('agencyName', event.target.value)} />
          </Field>
          <Field label="Your name on emails">
            <input value={draft.agentName} onChange={(event) => set('agentName', event.target.value)} />
          </Field>
          <Field label="Tagline">
            <input value={draft.tagline} onChange={(event) => set('tagline', event.target.value)} />
          </Field>
          <Field label="City">
            <input value={draft.city} onChange={(event) => set('city', event.target.value)} />
          </Field>
          <Field label="WhatsApp Business number">
            <input
              value={draft.whatsapp}
              placeholder="082 000 0000"
              onChange={(event) => set('whatsapp', event.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input value={draft.phone} onChange={(event) => set('phone', event.target.value)} />
          </Field>
          <Field label="Email for quote reminders">
            <input value={draft.email} onChange={(event) => set('email', event.target.value)} />
          </Field>
          <Field label="Instagram">
            <input value={draft.instagram} onChange={(event) => set('instagram', event.target.value)} />
          </Field>
          <Field label="TikTok">
            <input value={draft.tiktok} onChange={(event) => set('tiktok', event.target.value)} />
          </Field>
          <Field label="LinkedIn">
            <input value={draft.linkedin} onChange={(event) => set('linkedin', event.target.value)} />
          </Field>
          <Field label="Facebook">
            <input value={draft.facebook} onChange={(event) => set('facebook', event.target.value)} />
          </Field>
          <Field label="Lead webhook (optional)">
            <input
              value={draft.leadWebhook}
              placeholder="https://hook.make.com/..."
              onChange={(event) => set('leadWebhook', event.target.value)}
            />
          </Field>
        </div>
        <Field label="About you, shown in the footer">
          <textarea value={draft.bio} onChange={(event) => set('bio', event.target.value)} />
        </Field>
        <Field label="Trust line">
          <textarea value={draft.trustLine} onChange={(event) => set('trustLine', event.target.value)} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={draft.preview} onChange={(event) => set('preview', event.target.checked)} />
          Preview mode — warn that prices are samples
        </label>
        {draft.whatsapp.trim() && waDigits(draft.whatsapp).length < 10 && (
          <p className="warnline">That WhatsApp number looks short. Use a full number, like 082 000 0000.</p>
        )}
        {message && <p className="success">{message}</p>}
        <div className="actions">
          <button className="btn sea" type="submit">
            Save contacts
          </button>
        </div>
      </form>
      <section className="panel">
        <h2>Keep a copy</h2>
        <p>Download a backup if you want the same FlightAngel page on another computer. Import replaces what is on this one.</p>
        <div className="actions">
          <button type="button" className="btn quiet" onClick={exportBackup}>
            Download backup
          </button>
          <label className="btn quiet file">
            Import backup
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                file
                  .text()
                  .then((text) => {
                    const parsed: unknown = JSON.parse(text)
                    if (!isDeskState(parsed)) throw new Error('bad')
                    commit({
                      ...parsed,
                      agentId: desk.agentId,
                      slug: desk.slug,
                      settings: { ...parsed.settings, slug: desk.slug },
                    })
                    setMessage('Backup imported.')
                  })
                  .catch(() => setMessage('That file is not a FlightAngel backup.'))
              }}
            />
          </label>
          <button
            type="button"
            className="btn quiet"
            onClick={() => {
              if (window.confirm('Replace everything with the FlightAngel samples?')) {
                resetDemo()
                setMessage('FlightAngel samples restored.')
              }
            }}
          >
            Restore samples
          </button>
        </div>
      </section>
    </div>
  )
}
