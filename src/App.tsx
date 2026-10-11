import { useEffect, useState } from 'react'
import { Admin } from './Admin'
import { useDesk } from './store'
import { Storefront } from './Storefront'

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
  }, [hash])

  useEffect(() => {
    document.title = hash.startsWith('#/admin')
      ? `Agent desk · ${desk.settings.agencyName}`
      : desk.settings.agencyName
  }, [hash, desk.settings.agencyName])

  if (hash.startsWith('#/admin')) return <Admin />
  return <Storefront />
}
