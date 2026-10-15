import { FormEvent, useEffect, useState } from 'react'
import { money } from './format'
import { loadBoard, placeBid, postTripAsk, recordView, type TripPost } from './remote'
import { useDesk } from './store'
import { Field } from './ui'

function ago(iso: string) {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

function lowestPrice(post: TripPost) {
  return post.bids[0]?.price ?? 0
}

export function Feed() {
  useEffect(() => {
    recordView('home')
  }, [])

  return (
    <div className="store feed">
      <header className="top">
        <div>
          <p className="city-line">FlightAngel</p>
          <h1 className="word">The board</h1>
          <p className="tagline">Post a trip. Agents answer with a price, and they can only go lower.</p>
        </div>
        <nav className="nav">
          <a href="#/terms">Terms</a>
        </nav>
      </header>
      <AskBox />
      <PriceBoard canBid={false} />
    </div>
  )
}

export function PriceBoard({ canBid }: { canBid: boolean }) {
  const desk = useDesk()
  const [posts, setPosts] = useState<TripPost[]>([])
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  async function refresh() {
    const result = await loadBoard()
    setPosts(result.posts)
    setError(result.error)
    setReady(true)
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 20000)
    return () => window.clearInterval(timer)
  }, [])

  if (!ready) return <p className="intro">Opening the board…</p>
  if (error) return <p className="warnline">{error}</p>

  return (
    <div className="board">
      {posts.length === 0 && <p className="intro">No trips yet. The first post opens the board.</p>}
      {posts.map((post) => (
        <TripCard
          key={post.id}
          post={post}
          canBid={canBid}
          agentId={desk.agentId}
          agentName={desk.settings.agentName}
          agencyName={desk.settings.agencyName}
          onPriced={refresh}
        />
      ))}
    </div>
  )
}

function AskBox() {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [dates, setDates] = useState('')
  const [travellers, setTravellers] = useState('2 adults')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const problem = await postTripAsk({ name, destination, dates, travellers, note })
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    setDone(true)
    setDestination('')
    setNote('')
    window.setTimeout(() => window.location.reload(), 400)
  }

  return (
    <form className="post-card composer" onSubmit={submit}>
      <p className="kicker">New trip</p>
      <h2>Where do you want to go?</h2>
      <div className="composer-grid">
        <Field label="Your name">
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Destination">
          <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Mauritius" />
        </Field>
        <Field label="When">
          <input value={dates} onChange={(event) => setDates(event.target.value)} placeholder="12–20 Dec, or flexible" />
        </Field>
        <Field label="Travellers">
          <input value={travellers} onChange={(event) => setTravellers(event.target.value)} />
        </Field>
      </div>
      <Field label="Anything the agents should know">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {error && <p className="warnline">{error}</p>}
      {done && <p className="fine">Posted. Agents can price it now.</p>}
      <button className="btn solid" type="submit" disabled={busy || !name.trim() || !destination.trim()}>
        {busy ? 'Posting…' : 'Post this trip'}
      </button>
      <p className="fine">A price on the board is a quote, not a ticket, until that agent confirms it.</p>
    </form>
  )
}

function TripCard({
  post,
  canBid,
  agentId,
  agentName,
  agencyName,
  onPriced,
}: {
  post: TripPost
  canBid: boolean
  agentId: string
  agentName: string
  agencyName: string
  onPriced: () => Promise<void>
}) {
  const mine = post.bids.find((bid) => bid.agentId === agentId)
  const low = lowestPrice(post)
  const tied = post.bids.filter((bid) => bid.price === low).length > 1
  const initial = (post.name.trim()[0] || '?').toUpperCase()

  return (
    <article className="post-card">
      <header className="post-head">
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
        <div>
          <strong>{post.name}</strong>
          <p>
            {ago(post.createdAt)}
            {post.sample ? ' · Sample' : ''}
          </p>
        </div>
      </header>
      <h2>{post.destination}</h2>
      <p className="post-meta">
        {[post.travellers, post.dates].filter(Boolean).join(' · ') || 'Dates still open'}
      </p>
      {post.note && <p className="post-note">{post.note}</p>}
      <p className="post-low">
        {low > 0 ? (
          <>
            Lowest so far <b>{money(low)}</b>
            {tied ? ' · tied' : ''} · {post.bids.length} {post.bids.length === 1 ? 'price' : 'prices'}
          </>
        ) : (
          'No price yet. An agent can be first.'
        )}
      </p>
      <ul className="bid-thread">
        {post.bids.map((bid) => (
          <li key={bid.id} className={bid.price === low ? 'lowest' : ''}>
            <span className="avatar small" aria-hidden="true">
              {(bid.agentName.trim()[0] || 'A').toUpperCase()}
            </span>
            <div>
              <p>
                <strong>{bid.agentName}</strong>
                {bid.agencyName ? ` · ${bid.agencyName}` : ''}
                {bid.price === low && <em className="pill good">{tied ? 'Tied' : 'Lowest'}</em>}
              </p>
              <b>{money(bid.price)}</b>
              {bid.includes && <p>{bid.includes}</p>}
            </div>
          </li>
        ))}
      </ul>
      {canBid && (
        <BidBox
          requestId={post.id}
          bidId={mine?.id ?? ''}
          previousPrice={mine?.price ?? 0}
          floor={low}
          agentName={agentName}
          agencyName={agencyName}
          onPriced={onPriced}
        />
      )}
    </article>
  )
}

function BidBox({
  requestId,
  bidId,
  previousPrice,
  floor,
  agentName,
  agencyName,
  onPriced,
}: {
  requestId: string
  bidId: string
  previousPrice: number
  floor: number
  agentName: string
  agencyName: string
  onPriced: () => Promise<void>
}) {
  const [price, setPrice] = useState('')
  const [includes, setIncludes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const target = previousPrice > 0 ? previousPrice : floor

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const problem = await placeBid({
      requestId,
      bidId,
      agentName,
      agencyName,
      price: Number(price.replace(/[^\d.]/g, '')),
      includes,
      previousPrice,
      floor,
    })
    setBusy(false)
    if (problem) {
      setError(problem)
      return
    }
    setPrice('')
    setIncludes('')
    await onPriced()
  }

  return (
    <form className="bid-box" onSubmit={submit}>
      <Field label={previousPrice > 0 ? `Lower than ${money(previousPrice)}` : floor > 0 ? `Beat ${money(floor)}` : 'Your price, in rands'}>
        <input inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} placeholder={target > 0 ? String(target - 1) : '8490'} />
      </Field>
      <Field label="What that price includes">
        <input value={includes} onChange={(event) => setIncludes(event.target.value)} placeholder="Return flights and breakfast" />
      </Field>
      {error && <p className="warnline">{error}</p>}
      <button className="btn sea" type="submit" disabled={busy || !price.trim()}>
        {busy ? 'Posting…' : previousPrice > 0 ? 'Post a lower price' : 'Post your price'}
      </button>
    </form>
  )
}
