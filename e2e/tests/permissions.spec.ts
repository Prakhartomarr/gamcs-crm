import { test, expect, request as playwrightRequest } from '@playwright/test'
import * as fs from 'fs'
import { uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 1E (brief §6): the permissions matrix tested with a real BD login, negative paths
 * first. Another BD's lead by SPA URL, /api/resource, /api/method, the report view, export, the
 * desk list views at /app, the audit page and the referral-fee report.
 */
const adminCsrf = () => JSON.parse(fs.readFileSync('e2e/.auth/csrf.json', 'utf-8')).csrf_token as string
const bdCsrf = () => JSON.parse(fs.readFileSync('e2e/.auth/bd-csrf.json', 'utf-8')).csrf_token as string

test.describe('BD visibility limits', () => {
	test.use({ storageState: 'e2e/.auth/bd.json', viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	let admin: Awaited<ReturnType<typeof playwrightRequest.newContext>>
	let theirs = ''
	let theirDeal = ''
	let theirProposal = ''
	let mine = ''

	test.beforeAll(async () => {
		admin = await playwrightRequest.newContext({ baseURL: process.env.BASE_URL || 'http://crm.test:8000', storageState: 'e2e/.auth/user.json' })
		const h = { 'X-Frappe-CSRF-Token': adminCsrf() }
		const t = await admin.post('/api/resource/CRM Lead', { data: { first_name: `Theirs ${id}`, status: 'New', next_action_date: '2026-09-30', lead_owner: 'Administrator', email: `e2e-theirs-${id}@example.com` }, headers: h })
		theirs = (await t.json()).data.name
		const m = await admin.post('/api/resource/CRM Lead', { data: { first_name: `Mine ${id}`, status: 'New', next_action_date: '2026-09-30', lead_owner: 'bd-e2e@example.com', email: `e2e-mine-${id}@example.com` }, headers: h })
		mine = (await m.json()).data.name
		const d = await admin.post('/api/resource/CRM Deal', { data: { status: 'Negotiation', next_action_date: '2026-09-30', next_step: 'x', deal_owner: 'Administrator', email: `e2e-theirdeal-${id}@example.com`, currency: 'INR' }, headers: h })
		theirDeal = (await d.json()).data.name
		const p = await admin.post('/api/resource/GAMCS Proposal', { data: { deal: theirDeal, amount: 50000, proposal_date: '2026-09-09' }, headers: h })
		theirProposal = (await p.json()).data.name
	})

	test.afterAll(async () => {
		const h = { 'X-Frappe-CSRF-Token': adminCsrf() }
		for (const [dt, name] of [['GAMCS Proposal', theirProposal], ['CRM Deal', theirDeal], ['CRM Lead', theirs], ['CRM Lead', mine]] as const) {
			if (!name) continue
			try {
				const doc = await (await admin.get(`/api/resource/${dt}/${name}`)).json()
				if (doc.data?.next_action_task) await admin.delete(`/api/resource/CRM Task/${doc.data.next_action_task}`, { headers: h })
				await admin.delete(`/api/resource/${dt}/${name}`, { headers: h })
			} catch {
				// best-effort cleanup
			}
		}
		await admin.dispose()
	})

	test('SPA: another BD\'s lead by direct URL is refused, own lead opens', async ({ page }) => {
		await page.goto(`/crm/leads/${theirs}`)
		await page.waitForLoadState('networkidle')
		await expect(page.getByText(/not permitted|error occurred|not found/i).first()).toBeVisible()
		await page.goto(`/crm/leads/${mine}`)
		await page.waitForLoadState('networkidle')
		await expect(page.getByText(`Mine ${id}`).first()).toBeVisible()
	})

	test('API: /api/resource, /api/method, report view and export all refuse or exclude', async ({ request }) => {
		expect((await request.get(`/api/resource/CRM Lead/${theirs}`)).status()).toBe(403)
		expect((await request.get(`/api/resource/GAMCS Proposal/${theirProposal}`)).status()).toBe(403)
		const get = await request.post('/api/method/frappe.client.get', { data: { doctype: 'CRM Lead', name: theirs }, headers: { 'X-Frappe-CSRF-Token': bdCsrf() } })
		expect(get.status()).toBe(403)
		const report = await request.post('/api/method/frappe.desk.reportview.get', {
			data: { doctype: 'CRM Lead', fields: JSON.stringify(['name']), filters: '[]', page_length: 500 }, headers: { 'X-Frappe-CSRF-Token': bdCsrf() },
		})
		expect(report.ok()).toBeTruthy()
		const names = JSON.stringify(await report.json())
		expect(names).toContain(mine)
		expect(names).not.toContain(theirs)
		const proposals = await request.post('/api/method/frappe.desk.reportview.get', {
			data: { doctype: 'GAMCS Proposal', fields: JSON.stringify(['name']), filters: '[]', page_length: 500 }, headers: { 'X-Frappe-CSRF-Token': bdCsrf() },
		})
		expect(JSON.stringify(await proposals.json())).not.toContain(theirProposal)
		const exp = await request.post('/api/method/frappe.desk.reportview.export_query', {
			data: { doctype: 'CRM Lead', file_format_type: 'CSV', fields: JSON.stringify(['name']), filters: '[]' }, headers: { 'X-Frappe-CSRF-Token': bdCsrf() },
		})
		expect(exp.status()).toBe(403)
	})

	test('desk /app is closed to a Sales User entirely, so no list view can leak', async ({ page }) => {
		for (const url of ['/app/crm-lead', '/app/gamcs-proposal', '/app/version']) {
			await page.goto(url)
			await page.waitForLoadState('networkidle')
			await expect(page.getByRole('heading', { name: 'Not permitted' })).toBeVisible()
			await expect(page.getByText(`Theirs ${id}`)).toHaveCount(0)
			await expect(page.getByText(theirProposal)).toHaveCount(0)
		}
	})

	test('Management-only surfaces: audit page, audit API, referral-fee chart, sidebar link', async ({ page, request }) => {
		await page.goto('/crm/audit')
		await page.waitForLoadState('networkidle')
		await expect(page.getByText(/Management and Admin/)).toBeVisible()
		await expect(page.getByRole('link', { name: 'Audit log' })).toHaveCount(0)
		expect((await request.post('/api/method/gamcs_crm.api.audit.get_audit_log', { data: {}, headers: { 'X-Frappe-CSRF-Token': bdCsrf() } })).status()).toBe(403)
		const chart = await request.post('/api/method/crm.api.dashboard.get_chart', { data: { name: 'partner_fees', type: 'axis_chart' }, headers: { 'X-Frappe-CSRF-Token': bdCsrf() } })
		expect(chart.status()).toBe(403)
		expect((await request.get('/api/resource/Version?limit_page_length=1')).status()).toBe(403)
	})
})
