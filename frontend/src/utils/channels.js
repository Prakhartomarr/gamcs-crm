// GAMCS (L3, D15/D16): manual WhatsApp and LinkedIn touches. No Business API: the quick
// actions open the quick-log pre-set to the channel, and the chat or profile opens in a new tab.

// '+91 98765 43210', '098765 43210', '919876543210', '00971 50 123 4567' -> E.164, default +91
export function toE164(raw, defaultCode = '91') {
  if (!raw) return ''
  let s = String(raw).trim()
  const plus = s.startsWith('+')
  let d = s.replace(/\D/g, '')
  if (!d) return ''
  if (plus) return d.length >= 8 && d.length <= 15 ? '+' + d : ''
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = defaultCode + d.slice(1)
  else if (d.length === 10) d = defaultCode + d
  return d.length >= 11 && d.length <= 15 ? '+' + d : ''
}

export function whatsappUrl(raw) {
  const e164 = toE164(raw)
  return e164 ? `https://wa.me/${e164.slice(1)}` : ''
}

// a stored LinkedIn value may be a full URL, 'linkedin.com/in/x' or just the handle
export function linkedinUrl(raw) {
  if (!raw) return ''
  let s = String(raw).trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return /linkedin\.com/i.test(s) ? s : ''
  if (/linkedin\.com/i.test(s)) return 'https://' + s.replace(/^\/+/, '')
  if (/^[\w-]{3,100}$/.test(s)) return `https://www.linkedin.com/in/${s}`
  return ''
}

// first usable number on a record: WhatsApp number, then mobile, then phone
export function recordWhatsApp(doc) {
  return toE164(doc?.whatsapp_no) || toE164(doc?.mobile_no) || toE164(doc?.phone) || ''
}
