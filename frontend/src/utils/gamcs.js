// GAMCS: small formatting helpers shared by the GAMCS screens (UI_REVIEW.md).
// Indian digit grouping, day-month-year dates, and plain-language due dates.

const DAY = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toLocalDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  // 'YYYY-MM-DD' must be read as a local calendar day, not UTC midnight
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(value)
  return isNaN(d) ? null : d
}

/** 13 Nov 2026 */
export function formatDay(value) {
  const d = toLocalDate(value)
  if (!d) return ''
  // fixed month names: ICU renders September as "Sept" in en-GB/en-IN
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Whole days from today to the date (negative = past). */
export function daysFromToday(value, today = new Date()) {
  const d = toLocalDate(value)
  if (!d) return null
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((d - t) / DAY)
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "12 days overdue" */
export function dueLabel(value, today = new Date()) {
  const n = daysFromToday(value, today)
  if (n === null) return ''
  if (n === 0) return __('Today')
  if (n === 1) return __('Tomorrow')
  if (n === -1) return __('1 day overdue')
  if (n < 0) return __('{0} days overdue', [-n])
  return __('In {0} days', [n])
}

/** ₹12,00,000 (whole units, Indian grouping for INR; the currency's own symbol otherwise) */
export function formatMoney(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

/** +91 98765 43210 for Indian mobiles; anything else is returned as typed. */
export function formatPhone(value) {
  if (!value) return ''
  const digits = String(value).replace(/[^\d+]/g, '')
  const m = /^(?:\+?91)?([6-9]\d{4})(\d{5})$/.exec(digits)
  return m ? `+91 ${m[1]} ${m[2]}` : String(value)
}

/** The few deal numbers worth seeing without opening the side panel (RecordSummary facts). */
export function dealFacts(d = {}) {
  const out = []
  if (d.acv || d.deal_value)
    out.push({ label: __('ACV'), value: formatMoney(d.acv || d.deal_value, d.currency) })
  if (d.probability) out.push({ label: __('Probability'), value: `${Math.round(d.probability)}%` })
  if (d.expected_closure_date)
    out.push({ label: __('Close by'), value: formatDay(d.expected_closure_date) })
  return out
}

/** The few lead facts worth seeing without opening the side panel (RecordSummary facts). */
export function leadFacts(d = {}) {
  return [
    d.organization && { label: __('Organisation'), value: d.organization },
    d.source && { label: __('Source'), value: d.source },
  ].filter(Boolean)
}
