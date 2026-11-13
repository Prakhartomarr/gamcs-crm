import { describe, expect, it } from 'vitest'
import { linkedinUrl, recordWhatsApp, toE164, whatsappUrl } from '@/utils/channels'

describe('GAMCS channels (L3)', () => {
  it('normalises Indian and international numbers to E.164', () => {
    expect(toE164('98765 43210')).toBe('+919876543210')
    expect(toE164('098765-43210')).toBe('+919876543210')
    expect(toE164('+91 98765 43210')).toBe('+919876543210')
    expect(toE164('919876543210')).toBe('+919876543210')
    expect(toE164('+971 50 123 4567')).toBe('+971501234567')
    expect(toE164('00971501234567')).toBe('+971501234567')
    expect(toE164('12345')).toBe('')
    expect(toE164('')).toBe('')
    expect(toE164(null)).toBe('')
  })
  it('builds a wa.me link without the plus', () => {
    expect(whatsappUrl('98765 43210')).toBe('https://wa.me/919876543210')
    expect(whatsappUrl('abc')).toBe('')
  })
  it('prefers the WhatsApp number, then mobile, then phone', () => {
    expect(recordWhatsApp({ whatsapp_no: '+971501234567', mobile_no: '9876543210' })).toBe('+971501234567')
    expect(recordWhatsApp({ mobile_no: '9876543210' })).toBe('+919876543210')
    expect(recordWhatsApp({ phone: 'n/a' })).toBe('')
  })
  it('accepts LinkedIn URLs, bare domains and handles, rejects other sites', () => {
    expect(linkedinUrl('https://www.linkedin.com/in/jane')).toBe('https://www.linkedin.com/in/jane')
    expect(linkedinUrl('linkedin.com/in/jane')).toBe('https://linkedin.com/in/jane')
    expect(linkedinUrl('jane-doe')).toBe('https://www.linkedin.com/in/jane-doe')
    expect(linkedinUrl('https://evil.example/in/jane')).toBe('')
    expect(linkedinUrl('javascript:alert(1)')).toBe('')
  })
})
