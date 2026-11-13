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
export function dealFacts(d = {}, ownerName = '') {
  const out = []
  if (d.acv || d.deal_value)
    out.push({ label: __('ACV'), value: formatMoney(d.acv || d.deal_value, d.currency) })
  if (d.probability) out.push({ label: __('Probability'), value: `${Math.round(d.probability)}%` })
  if (d.expected_closure_date)
    out.push({ label: __('Close by'), value: formatDay(d.expected_closure_date) })
  // GAMCS E65 (PRD §23 summary block): owner, source and service beside the numbers
  if (ownerName) out.push({ label: __('Owner'), value: ownerName })
  if (d.source) out.push({ label: __('Source'), value: d.source })
  if (d.service_summary) out.push({ label: __('Service'), value: d.service_summary })
  return out
}

/** E65 (PRD §6, D3): the advisory qualification checklist, same rules as record_extras.py. */
export function qualification(d = {}) {
  const filled = (v) => !!String(v || '').trim()
  const items = [
    { key: 'budget_known', label: __('Budget known'), done: !!d.budget_known },
    { key: 'decision_maker', label: __('Decision maker identified'), done: filled(d.decision_maker) },
    { key: 'decision_timeline', label: __('Decision timeline'), done: filled(d.decision_timeline) },
    { key: 'scope', label: __('Scope understood'), done: !!d.requirement_understood || filled(d.requirement_description) },
    { key: 'proposal_required', label: __('Proposal required answered'), done: ['Yes', 'No'].includes(d.proposal_required) },
  ]
  return { done: items.filter((i) => i.done).length, total: items.length, items }
}

/** The few lead facts worth seeing without opening the side panel (RecordSummary facts). */
export function leadFacts(d = {}, ownerName = '') {
  return [
    d.organization && { label: __('Organisation'), value: d.organization },
    ownerName && { label: __('Owner'), value: ownerName }, // GAMCS E65
    d.source && { label: __('Source'), value: d.source },
    d.service_summary && { label: __('Service'), value: d.service_summary }, // GAMCS E65
  ].filter(Boolean)
}

/** E65 (PRD §17): compact deal card cells. ACV in INR, probability and close date share one
 * line; next action text and its due date share another, overdue highlighted. Returns only
 * the cells it renders; a field folded into another line gets an empty label so it is skipped. */
export function dealCardCells(d = {}, fields = []) {
  const has = (f) => fields.includes(f)
  const out = {}
  const moneyKey = ['base_acv', 'acv', 'probability', 'expected_closure_date'].find(has)
  if (moneyKey) {
    const acv = Number(d.base_acv ?? 0) || (d.currency === 'INR' ? Number(d.acv) || 0 : 0)
    const parts = [
      (has('base_acv') || has('acv')) && acv ? formatMoney(acv, 'INR') : '',
      has('probability') && d.probability ? `${Math.round(d.probability)}%` : '',
      has('expected_closure_date') && d.expected_closure_date
        ? __('Close {0}', [formatDay(d.expected_closure_date)])
        : '',
    ].filter(Boolean)
    for (const f of ['base_acv', 'acv', 'probability', 'expected_closure_date'])
      if (has(f)) out[f] = { label: '' }
    out[moneyKey] = { label: parts.join(' · '), gamcs: 'money' }
  }
  const nextKey = ['next_step', 'next_action_date'].find(has)
  if (nextKey) {
    const text = d.next_step || (d.next_action_date ? __('Follow up') : '')
    for (const f of ['next_step', 'next_action_date']) if (has(f)) out[f] = { label: '' }
    out[nextKey] = {
      label: text,
      due: dueLabel(d.next_action_date),
      overdue: (daysFromToday(d.next_action_date) ?? 0) < 0,
      gamcs: 'next',
    }
  }
  if (has('contact_name')) out.contact_name = { label: d.contact_name || '', gamcs: 'contact' }
  if (has('service_summary')) out.service_summary = { label: d.service_summary || '', gamcs: 'service' }
  return out
}
