import { test, expect } from '@playwright/test'
import { createDoc, deleteDoc, getDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS PRD §18 (E44): Cmd/Ctrl+K finds a lead by its phone typed with spaces and without the
 * country code, under a "Leads" group with company · ID · owner · status; Enter opens it.
 */
test.describe('Global search', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	const digits = `9${String(Date.now()).slice(-9)}` // unique 10-digit mobile per run
	let lead = ''

	test.beforeAll(async ({ request }) => {
		const doc = await createDoc<{ name: string }>(request, 'CRM Lead', {
			first_name: `E2E Search ${id}`,
			organization: `E2E Search Co ${id}`,
			mobile_no: `+91${digits}`,
			status: 'New',
			next_action_date: '2026-12-31',
		})
		lead = doc.name
	})

	test.afterAll(async ({ request }) => {
		try {
			const doc = await getDoc<{ next_action_task?: string }>(request, 'CRM Lead', lead)
			if (doc.next_action_task) await deleteDoc(request, 'CRM Task', doc.next_action_task)
			await deleteDoc(request, 'CRM Lead', lead)
		} catch {
			// best-effort cleanup
		}
	})

	test('Cmd+K finds a lead by phone typed with spaces and Enter opens it', async ({ page }) => {
		await page.goto('/crm/leads')
		await page.waitForLoadState('networkidle')
		await page.keyboard.press('ControlOrMeta+k')
		const input = page.getByPlaceholder('Search records or type a command...')
		await expect(input).toBeFocused()
		await input.fill(`${digits.slice(0, 5)} ${digits.slice(5)}`)

		const option = page.getByRole('option', { name: new RegExp(`E2E Search ${id}`) })
		await expect(option).toBeVisible()
		await expect(option).toContainText(lead) // subtitle: company · ID · owner · status
		await expect(option).toContainText('New')
		await expect(page.getByRole('dialog').getByText('Leads', { exact: true })).toBeVisible()

		await option.hover()
		await input.press('Enter')
		await expect(page).toHaveURL(new RegExp(`/crm/leads/${lead}`))
	})
})
