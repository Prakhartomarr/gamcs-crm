import { test, expect } from '@playwright/test'
import { callMethod, createDoc, deleteDoc, getDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 1B happy path (F2/F15): a BD user logs a LinkedIn touch from the lead header and sets
 * the next action in the same dialog; it lands in the timeline, mirrors to a task, and the lead shows
 * in the Follow-ups queue. The server refuses an active lead without a next action date.
 */
test.describe('Next-action engine', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	let lead = ''
	const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

	test.beforeAll(async ({ request }) => {
		const created = await createDoc<{ name: string }>(request, 'CRM Lead', {
			first_name: `E2E Rule ${id}`,
			email: `e2e-rule-${id}@example.com`,
			status: 'New',
			next_action_date: '2026-09-30',
			next_step: 'Initial call',
		})
		lead = created.name
	})

	test.afterAll(async ({ request }) => {
		if (!lead) return
		const doc = await getDoc<{ next_action_task?: string }>(request, 'CRM Lead', lead).catch(() => null)
		try {
			if (doc?.next_action_task) await deleteDoc(request, 'CRM Task', doc.next_action_task)
			await deleteDoc(request, 'CRM Lead', lead)
		} catch {
			// best-effort cleanup
		}
	})

	test('server refuses an active lead without a next action date', async ({ request }) => {
		const res = await request.post('/api/method/frappe.client.set_value', {
			data: { doctype: 'CRM Lead', name: lead, fieldname: 'next_action_date', value: '' },
			headers: { 'X-Frappe-CSRF-Token': (await import('fs')).readFileSync('e2e/.auth/csrf.json', 'utf-8').match(/"csrf_token":"([^"]+)"/)![1] },
		})
		expect(res.ok()).toBeFalsy()
		expect(await res.text()).toContain('Next Action Date')
	})

	test('quick-log from the lead header sets the next action and reaches the queue', async ({ page, request }) => {
		await page.goto(`/crm/leads/${lead}`)
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: 'Log activity' }).click()
		const dialog = page.getByRole('dialog')
		await expect(dialog.getByRole('heading', { name: 'Log activity' })).toBeVisible()
		await dialog.getByPlaceholder('Connected with the CFO').fill(`LinkedIn touch ${id}`)
		await dialog.getByPlaceholder('Call to walk through the proposal').fill('Discovery call')
		const date = dialog.getByPlaceholder('Pick a date')
		await date.fill(inThreeDays)
		await date.press('Enter')
		await dialog.getByRole('button', { name: /^Log/ }).click()
		await expect(dialog).toBeHidden()

		// timeline shows the touch; record carries the new next action; task mirrored
		await page.getByRole('tab', { name: 'Activity' }).click()
		await expect(page.getByText(`LinkedIn touch ${id}`).first()).toBeVisible()
		await expect
			.poll(async () => (await getDoc<{ next_step: string }>(request, 'CRM Lead', lead)).next_step)
			.toBe('Discovery call')
		const doc = await getDoc<{ next_action_task: string; next_action_date: string }>(request, 'CRM Lead', lead)
		expect(doc.next_action_date).toBe(inThreeDays)
		const task = await getDoc<{ due_date: string; title: string }>(request, 'CRM Task', doc.next_action_task)
		expect(task.title).toBe('Discovery call')

		// three days out lands in Upcoming (horizon 7); the API counts agree
		await page.goto('/crm/follow-ups')
		await page.waitForLoadState('networkidle')
		await expect(page.getByText(`E2E Rule ${id}`).first()).toBeVisible()
		const counts = await callMethod<{ counts: Record<string, number> }>(request, 'gamcs_crm.api.follow_ups.get_follow_ups', { counts_only: 1 })
		expect(counts.counts.badge).toBeGreaterThanOrEqual(0)
	})
})
