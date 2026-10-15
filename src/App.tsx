import { useEffect, useState } from 'react'
import { Admin } from './Admin'
import { openAdmin, openCustomer, openIdle } from './remote'
import { useDesk } from './store'
import { Storefront } from './Storefront'
import { Terms } from './Terms'

function isTerms(hash: string) {
  return hash === '#/terms' || hash.startsWith('#/terms?')
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
    window.scrollTo(0, 0)
    if (hash.startsWith('#/admin')) void openAdmin()
    else if (!isTerms(hash)) {
      const slug = readSlug(hash)
      if (slug) void openCustomer(slug)
      else void openIdle()
    }
  }, [hash])

  useEffect(() => {
    document.title = hash.startsWith('#/admin')
      ? `Agent desk · ${desk.settings.agencyName}`
      : isTerms(hash)
        ? 'Terms'
        : desk.settings.agencyName
  }, [hash, desk.settings.agencyName])

  if (hash.startsWith('#/admin')) return <Admin />
  if (isTerms(hash)) return <Terms />
  return <Storefront />
}
