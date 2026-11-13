import { daysFromToday, dueLabel, formatDay, formatMoney, formatPhone } from '@/utils/gamcs'

describe('GAMCS formatting helpers', () => {
  const today = new Date(2026, 10, 13)
  it('formats days as 13 Nov 2026', () => {
    expect(formatDay('2026-11-13')).toBe('13 Nov 2026')
    expect(formatDay('')).toBe('')
  })
  it('says when something is due in plain words', () => {
    expect(daysFromToday('2026-11-13', today)).toBe(0)
    expect(dueLabel('2026-11-13', today)).toBe('Today')
    expect(dueLabel('2026-11-14', today)).toBe('Tomorrow')
    expect(dueLabel('2026-11-16', today)).toBe('In 3 days')
    expect(dueLabel('2026-11-12', today)).toBe('1 day overdue')
    expect(dueLabel('2026-09-30', today)).toBe('44 days overdue')
  })
  it('groups rupees the Indian way', () => {
    expect(formatMoney(1200000)).toBe('₹12,00,000')
    expect(formatMoney(1183333.4)).toBe('₹11,83,333')
  })
  it('chunks Indian mobile numbers', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210')
    expect(formatPhone('+91-98765-43210')).toBe('+91 98765 43210')
    expect(formatPhone('+971 50 123 4567')).toBe('+971 50 123 4567')
  })
})
