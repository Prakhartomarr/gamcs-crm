// throwaway: live screenshots, light + dark, desktop + mobile
import { chromium } from '@playwright/test'
const BASE = 'http://gamcs.localhost:8000'
const OUT = process.argv[2]
const only = process.argv[3] ? process.argv[3].split(',') : null
const themes = (process.argv[4] || 'light,dark').split(',')
const deal = '/crm/deals/' + (process.env.DEAL || 'CRM-DEAL-2026-00001')
const pages = [
  ['dashboard', '/crm/dashboard'], ['follow-ups', '/crm/follow-ups'], ['leads-list', '/crm/leads/view/list'],
  ['leads-kanban', '/crm/leads/view/kanban'], ['deals-kanban', '/crm/deals/view/kanban'], ['lead', '/crm/leads/' + (process.env.LEAD || 'CRM-LEAD-2026-00003')],
  ['deal', deal], ['deal-proposals', deal + '#proposals'], ['relationships', '/crm/relationships/view/list'],
  ['audit', '/crm/audit'], ['deals-list', '/crm/deals/view/list'], ['contacts', '/crm/contacts/view/list'],
]
const browser = await chromium.launch()
for (const theme of themes) for (const [vw, vh, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: theme })
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t) } catch {} }, theme)
  const p = await ctx.newPage()
  const name = (n) => `${OUT}/${n}-${theme}-${tag}.png`
  const shot = async (n) => { await p.waitForTimeout(1500); await p.screenshot({ path: name(n) }) }
  const want = (n) => !only || only.includes(n)
  const step = async (n, fn) => { if (!want(n)) return; try { await fn() } catch (e) { console.log(n, theme, tag, String(e).split('\n')[0].slice(0, 200)) } await p.keyboard.press('Escape').catch(() => {}) }
  await step('login', async () => { await p.goto(BASE + '/login'); await shot('login') })
  await ctx.request.post(BASE + '/api/method/login', { form: { usr: 'Administrator', pwd: 'admin' } })
  const go = async (u) => { await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {}) }
  for (const [n, u] of pages) await step(n, async () => { await go(u); await shot(n) })
  await step('dlg-won', async () => { await go(deal); await p.getByTestId('deal-status-dropdown').or(p.getByRole('button', { name: /Negotiation/ })).first().click(); await p.getByRole('menuitem', { name: 'Won', exact: true }).click(); await shot('dlg-won') })
  await step('dlg-quicklog', async () => { await go(deal); await p.getByRole('button', { name: /Log activity/ }).first().click(); await shot('dlg-quicklog') })
  await step('dlg-lost', async () => { await go(deal); await p.getByTestId('deal-status-dropdown').or(p.getByRole('button', { name: /Negotiation/ })).first().click(); await p.getByRole('menuitem', { name: 'Lost', exact: true }).click(); await shot('dlg-lost') })
  await step('dlg-convert', async () => { await go('/crm/leads/' + (process.env.LEAD || 'CRM-LEAD-2026-00003')); await p.getByRole('button', { name: /Convert/ }).first().click(); await shot('dlg-convert') })
  await step('dlg-newlead', async () => { await go('/crm/leads/view/list'); await p.getByRole('button', { name: /Create/ }).first().click(); await shot('dlg-newlead') })
  if (tag === 'd') {
    await step('palette', async () => { await go('/crm/leads/view/list'); await p.keyboard.press('Meta+k'); await p.waitForTimeout(500); await p.keyboard.type('E2E'); await shot('palette') })
    await step('settings', async () => { await go('/crm/leads/view/list'); await p.getByText('GAMCS CRM', { exact: true }).first().click(); await p.getByText('Settings', { exact: true }).first().click(); await p.waitForTimeout(800); await shot('settings'); await p.getByText('Notifications', { exact: true }).last().click(); await shot('settings-notifications') })
  }
  await ctx.close()
}
await browser.close()
