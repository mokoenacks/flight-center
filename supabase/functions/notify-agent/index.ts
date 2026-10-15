import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'npm:denomailer@1.6.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return Object.values(parsed)[0] ?? ''
  } catch {
    return ''
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ sent: false }, 405)

  const payload = (await request.json().catch(() => null)) as { leadId?: string } | null
  const leadId = payload?.leadId?.trim() ?? ''
  if (!leadId) return json({ sent: false }, 400)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = serviceKey()
  if (!url || !key) return json({ sent: false }, 500)

  const supabase = createClient(url, key)
  const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle()
  if (leadError || !lead) return json({ sent: false }, 404)
  if (lead.emailed_at) return json({ sent: true })
  if (!String(lead.source ?? '').toLowerCase().includes('email')) return json({ sent: false })

  const { data: agent } = await supabase.from('agent').select('*').eq('id', lead.agent_id).maybeSingle()
  const to = String(agent?.email ?? '').trim()
  if (!to) return json({ sent: false, reason: 'no-email' })

  const host = Deno.env.get('SMTP_HOST') ?? ''
  const user = Deno.env.get('SMTP_USER') ?? ''
  const pass = Deno.env.get('SMTP_PASS') ?? ''
  const port = Number(Deno.env.get('SMTP_PORT') ?? '587')
  const from = Deno.env.get('SMTP_FROM') || user
  if (!host || !user || !pass || !from) return json({ sent: false, reason: 'smtp' }, 503)

  const lines = [
    `${lead.name} asked for a quote.`,
    lead.to_place ? `Where to: ${lead.to_place}` : '',
    lead.from_place ? `Leaving from: ${lead.from_place}` : '',
    lead.dates ? `Dates: ${lead.dates}` : '',
    lead.travellers ? `Travellers: ${lead.travellers}` : '',
    lead.kind ? `Trip: ${lead.kind}` : '',
    lead.phone ? `Phone: ${lead.phone}` : '',
    lead.email ? `Email: ${lead.email}` : '',
    lead.notes ? `Notes: ${lead.notes}` : '',
    '',
    'Reply to the customer. This reminder was sent because they chose email.',
  ].filter((line) => line !== undefined)

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      auth: { username: user, password: pass },
    },
  })

  try {
    await client.send({
      from,
      to,
      subject: `New quote${lead.to_place ? ` for ${lead.to_place}` : ''}`,
      content: lines.join('\n'),
      replyTo: lead.email ? String(lead.email) : undefined,
    })
  } catch {
    return json({ sent: false, reason: 'smtp' }, 502)
  } finally {
    try {
      await client.close()
    } catch {
      /* The message was already handed to the server. */
    }
  }

  await supabase.from('leads').update({ emailed_at: new Date().toISOString() }).eq('id', leadId)
  return json({ sent: true })
})
