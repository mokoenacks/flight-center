export function money(value: number) {
  return `R${Math.round(value).toLocaleString('en-ZA')}`
}

export function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function planMonday(from = new Date()) {
  const date = new Date(from)
  date.setHours(12, 0, 0, 0)
  const day = date.getDay()
  const monday = new Date(date)
  const delta = day === 0 ? -6 : 1 - day
  monday.setDate(date.getDate() + delta)
  if (day === 0 || day === 6) monday.setDate(monday.getDate() + 7)
  monday.setHours(12, 0, 0, 0)
  return monday
}

export function prettyDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function prettyWhen(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function waDigits(raw: string) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = `27${digits.slice(1)}`
  return digits
}

export function samePrice(label: string, price: number) {
  return label.replace(/\D/g, '').includes(String(Math.round(price)))
}
