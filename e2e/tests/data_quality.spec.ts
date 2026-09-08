import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import { callMethod, createDoc, deleteDoc, getDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 1D happy path (F11/F14/F16): creating a lead for a company that already exists opens
 * the duplicate dialog and "Create anyway" records the override; a status change shows up on the
 * audit page as a sentence; the dashboard is served through the GAMCS override and offers the
 * contributed charts.
 */
const csrf = () => JSON.parse(fs.readFileSync('e2e/.auth/csrf.json', 'utf-8')).csrf_token as string

test.describe('Data quality & visibility', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	const company = `E2E Dup Co ${id}`
	let first = ''
	let second = ''
	let deal = ''

	test.beforeAll(async ({ request }) => {
		const lead = await createDoc<{ name: string }>(request, 'CRM Lead', {
			first_name: `E2E Dup ${id}`, organization: `${company} Pvt Ltd`, email: `e2e-dup-${id}@example.com`, status: 'New', next_action_date: '2026-09-30',
		})
		first = lead.name
		const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
			status: 'New Opportunity', next_action_date: '2026-09-30', next_step: 'x', email: `e2e-audit-${id}@example.com`, currency: 'INR',
		})
		deal = d.name
		await request.post('/api/method/frappe.client.set_value', {
			data: { doctype: 'CRM Deal', name: deal, fieldname: 'status', value: 'Negotiation' },
			headers: { 'X-Frappe-CSRF-Token': csrf() },
		})
	})

	test.afterAll(async ({ request }) => {
		for (const [dt, name] of [['CRM Lead', second], ['CRM Lead', first], ['CRM Deal', deal]] as const) {
			if (!name) continue
			try {
				const doc = await getDoc<{ next_action_task?: string }>(request, dt, name)
				if (doc.next_action_task) await deleteDoc(request, 'CRM Task', doc.next_action_task)
				await deleteDoc(request, dt, name)
			} catch {
				// best-effort cleanup
			}
		}
	})

	test('creating a lead for a known company asks first, and "Create anyway" records the override', async ({ page, request }) => {
		await page.goto('/crm/leads')
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: 'Create', exact: true }).click()
		const dialog = page.getByRole('dialog')
		await dialog.getByPlaceholder('First Name', { exact: true }).fill(`E2E Dup Again ${id}`)
		await dialog.getByPlaceholder('Organization', { exact: true }).fill(`${company} Private Limited`)
		const date = dialog.getByPlaceholder('Next Action Date', { exact: true })
		await date.fill('2026-09-30')
		await date.press('Enter')
		await dialog.getByRole('button', { name: 'Create', exact: true }).click()

		await expect(page.getByText('Looks like a duplicate')).toBeVisible()
		const list = page.getByTestId('duplicate-list')
		await expect(list.getByText(first)).toBeVisible()
		await expect(list.getByText('company')).toBeVisible()
		await page.getByRole('button', { name: 'Create anyway' }).click()
		await expect(page).toHaveURL(/\/crm\/leads\/CRM-LEAD/)
		second = new URL(page.url()).pathname.split('/').pop()! // drop the #activity fragment
		const doc = await getDoc<{ duplicate_override_of: string }>(request, 'CRM Lead', second)
		expect(doc.duplicate_override_of).toBe(`CRM Lead:${first}`)
	})

	test('the server refuses a silent duplicate lead through the API', async ({ request }) => {
		const res = await request.post('/api/resource/CRM Lead', {
			data: { first_name: 'Silent', organization: `${company} LLP`, status: 'New', next_action_date: '2026-09-30' },
			headers: { 'X-Frappe-CSRF-Token': csrf() },
		})
		expect(res.ok()).toBeFalsy()
		expect(await res.text()).toContain('duplicate')
	})

	test('the audit page reads a stage change as a sentence', async ({ page }) => {
		await page.goto('/crm/audit')
		await page.waitForLoadState('networkidle')
		await expect(page.getByText('Audit log').first()).toBeVisible()
		await page.getByTestId('audit-filters').getByPlaceholder('CRM-DEAL-2026-00012').fill(deal)
		await page.getByRole('button', { name: 'Apply' }).click()
		await expect(page.getByTestId('audit-table')).toContainText('changed Status New Opportunity → Negotiation')
	})

	test('dashboard is served through the override and offers the GAMCS charts', async ({ page, request }) => {
		const options = await callMethod<Record<string, { value: string }[]>>(request, 'gamcs_crm.api.dashboard.get_chart_options')
		expect(options.number_chart.map((o) => o.value)).toContain('weighted_pipeline')
		const chart = await callMethod<{ title: string }>(request, 'crm.api.dashboard.get_chart', { name: 'weighted_pipeline', type: 'number_chart' })
		expect(chart.title).toBe('Weighted pipeline')
		await page.goto('/crm/dashboard')
		await page.waitForLoadState('networkidle')
		await expect(page.getByText('Total leads').first()).toBeVisible() // upstream card still rendered via our override
	})
})
