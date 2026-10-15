import { useEffect } from 'react'
import { recordView } from './remote'

export function Terms() {
  useEffect(() => {
    recordView('terms')
  }, [])

  const back = sessionStorage.getItem('flight-desk-slug')

  return (
    <div className="store">
      <header className="top">
        <a className="word" href={back ? `#/a/${back}` : '#/'}>
          Back
        </a>
      </header>
      <article className="legal">
        <p className="kicker">Terms</p>
        <h1>What this website collects</h1>
        <p>
          This is a travel desk page. The consultant whose link you opened uses it to show sample trips and take a
          quote. A quote is a request for a person to check a fare. It is not a booking, and a from-price on the page
          is not a ticket until that consultant confirms it.
        </p>

        <h2>When you only look</h2>
        <p>Opening a page stores three things, and nothing with your name:</p>
        <ul>
          <li>An anonymous id kept in this browser, so the same person is not counted as a new visitor every time.</li>
          <li>Which page opened: the opening page, a consultant’s page, or this terms page.</li>
          <li>The date and time of that visit.</li>
        </ul>
        <p>
          Refreshing the same page does not add another visit. The consultant sees the counts on their desk. They do
          not see your name from a visit.
        </p>

        <h2>When you ask for a quote</h2>
        <p>The quote form stores only what you type:</p>
        <ul>
          <li>Your name.</li>
          <li>Your phone number, your email, or both, depending on what you fill in.</li>
          <li>Where you are leaving from, where you want to go, dates, how many people, the kind of trip, and any note.</li>
        </ul>
        <p>
          That quote is saved for the consultant on the page you opened. If you send by email, a reminder is also sent
          to that consultant’s inbox. If you send by WhatsApp, WhatsApp opens on your phone with the trip filled in.
          The message is sent only when you press send there.
        </p>

        <h2>Who else handles it</h2>
        <p>
          The desk is stored in Supabase. This website is hosted on Render. Render keeps ordinary connection logs,
          including an IP address, so it can deliver the page. Those host logs are not part of the visitor report, and
          this site does not sell your details.
        </p>

        <h2>Asking for a change</h2>
        <p>
          To correct or delete a quote, contact the consultant on the page where you sent it. They are the person who
          holds that quote and who replies to you.
        </p>
      </article>
    </div>
  )
}
