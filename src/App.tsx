import { useEffect, useState } from 'react'
import { Admin, ResetPassword } from './Admin'
import { openAdmin, openCustomer, openIdle, useRemoteStatus } from './remote'
import { useDesk } from './store'
import { Storefront } from './Storefront'
import { Terms } from './Terms'

function isAdmin(hash: string) {
  return hash.toLowerCase().startsWith('#/admin')
}

function ResetPage() {
  const remote = useRemoteStatus()
  const [fromEmail] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const current = window.location.hash
    return params.has('code') || current.includes('type=recovery') || current.includes('access_token')
  })
  const [giveUp, setGiveUp] = useState(false)

  useEffect(() => {
    if (!fromEmail) return
    const timer = window.setTimeout(() => setGiveUp(true), 8000)
    return () => window.clearTimeout(timer)
  }, [fromEmail])

  if (remote.recovery) return <ResetPassword email={remote.email} />
  const opening = fromEmail && !giveUp
  return (
    <div className="desk">
      <main className="workspace">
        <h1 className="page-title">{opening ? 'Opening your reset link…' : 'This reset link has expired'}</h1>
        <p className="intro">
          {opening
            ? 'Supabase is checking the email link.'
            : 'Ask for a new link from the sign-in page. The old one can only be used once.'}
        </p>
        {!opening && (
          <p>
            <a href="#/admin">Back to sign in</a>
          </p>
        )}
      </main>
    </div>
  )
}

function isReset(hash: string) {
  return hash.toLowerCase().startsWith('#/reset')
}

function isTerms(hash: string) {
  return hash === '#/terms' || hash.toLowerCase().startsWith('#/terms?')
}

function readSlug(hash: string) {
  const match = hash.match(/^#\/a\/([a-z0-9-]{1,40})\/?$/i)
  return match?.[1] ?? ''
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash)
  const desk = useDesk()

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '')
    const params = new URLSearchParams(window.location.search)
    const hash = window.location.hash
    const tokenInHash = hash.includes('access_token') || hash.includes('type=recovery')
    if (!tokenInHash && params.has('code') && !isReset(hash)) {
      window.location.hash = '#/reset'
    }
    if (path.toLowerCase() === '/admin' && !isAdmin(hash) && !tokenInHash) {
      window.location.hash = '#/admin'
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    if (isAdmin(hash)) void openAdmin()
    else if (isReset(hash)) return
    else if (!isTerms(hash)) {
      const slug = readSlug(hash)
      if (slug) void openCustomer(slug)
      else void openIdle()
    }
  }, [hash])

  useEffect(() => {
    const agency = desk.settings.agencyName.trim()
    document.title = isReset(hash)
      ? 'Reset password · FlightAngel'
      : isAdmin(hash)
        ? agency
          ? `FlightAngel · ${agency}`
          : 'FlightAngel'
        : isTerms(hash)
          ? 'Terms · FlightAngel'
          : agency
            ? `${agency} · FlightAngel`
            : 'FlightAngel'
  }, [hash, desk.settings.agencyName])

  if (isReset(hash)) return <ResetPage />
  if (isAdmin(hash)) return <Admin />
  if (isTerms(hash)) return <Terms />
  return <Storefront />
}
