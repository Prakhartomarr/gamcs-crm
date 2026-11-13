import { vi } from 'vitest'

// GAMCS: the Audit log item's condition reads the users store; no Pinia in unit tests
vi.mock('@/stores/users', () => ({ usersStore: () => ({ isManager: () => true }) }))

import { getNavigationItems, navigationItems } from '@/utils/navigation'

describe('navigationItems', () => {
  it('uses unique route names', () => {
    const routes = navigationItems.map((item) => item.route)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('omits desktop-only destinations on mobile', () => {
    const mobileRoutes = getNavigationItems({ mobile: true }).map(
      (item) => item.route,
    )
    expect(mobileRoutes).not.toContain('Dashboard')
    expect(mobileRoutes).not.toContain('Calendar')
    expect(mobileRoutes).toContain('Leads')
  })
})

// GAMCS: nav chunked into short labelled groups
describe('navigation groups', () => {
  it('puts every item in a group of at most seven', () => {
    const counts = {}
    for (const item of navigationItems) {
      expect(item.group).toBeTruthy()
      counts[item.group] = (counts[item.group] || 0) + 1
    }
    for (const n of Object.values(counts)) expect(n).toBeLessThanOrEqual(7)
  })
})
