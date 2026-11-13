import { test, expect, APIRequestContext, Page } from '@playwright/test'
import { callMethod, createDoc, deleteDoc, getDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS PRD §17 (1C deferral): dropping a deal card on the Kanban Won column opens the Won dialog
 * pre-filled; Cancel puts the card back, Confirm moves it and creates the engagement through the
 * same server path as the deal page. Dropping on Lost opens the Lost-reason dialog.
 */
const OPEN_STATUSES = ['Verbal Confirmation', 'Negotiation', 'Scope/Requirement Understood', 'Qualified Opportunity']

/** Kanban columns load in `modified asc` pages (E28): start from the emptiest open column so the new card is on the board. */
async function emptiestOpenStatus(request: APIRequestContext) {
	const counts = await Promise.all(
		OPEN_STATUSES.map((status) => callMethod<number>(request, 'frappe.client.get_count', { doctype: 'CRM Deal', filters: { status } })),
	)
	return OPEN_STATUSES[counts.indexOf(Math.min(...counts))]
}

async function drag(page: Page, name: string, column: string) {
	const card = page.locator(`[data-name="${name}"]`)
	const target = page.locator(`[data-column="${column}"]`)
	await card.scrollIntoViewIfNeeded()
	await target.scrollIntoViewIfNeeded()
	await card.dragTo(target, { targetPosition: { x: 60, y: 60 } })
}

test.describe('Kanban drop onto Won / Lost', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	const orgName = `E2E Kanban Org ${id}`
	let status = ''
	const deals: string[] = []

	test.beforeAll(async ({ request }) => {
		status = await emptiestOpenStatus(request)
		await createDoc(request, 'CRM Organization', { organization_name: orgName })
		for (const suffix of ['won', 'lost']) {
			const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
				organization: orgName, status, next_action_date: '2026-12-31', next_step: 'Close', currency: 'INR',
				email: `e2e-kanban-${suffix}-${id}@example.com`, billing_frequency: 'Monthly', billed_amount: 100000,
				contract_duration_months: 12, service_interest: [{ service: 'FP&A' }], expected_start_date: '2026-12-01',
			})
			deals.push(d.name)
		}
	})

	test.afterAll(async ({ request }) => {
		for (const name of deals) {
			try {
				const doc = await getDoc<{ engagement?: string }>(request, 'CRM Deal', name)
				if (doc.engagement) {
					await callMethod(request, 'frappe.client.set_value', { doctype: 'CRM Deal', name, fieldname: 'engagement', value: '' })
					await deleteDoc(request, 'GAMCS Engagement', doc.engagement)
				}
				await deleteDoc(request, 'CRM Deal', name)
			} catch {
				// best-effort cleanup
			}
		}
	})

	test.beforeEach(async ({ page }) => {
		await page.goto('/crm/deals/view/kanban')
		await page.waitForLoadState('networkidle')
		const skip = page.getByRole('button', { name: 'Skip all' })
		if (await skip.count()) await skip.click()
	})

	test('drop on Won opens the dialog; cancel returns the card, confirm marks Won with one engagement', async ({ page, request }) => {
		const [deal] = deals
		await drag(page, deal, 'Won')
		const dialog = page.getByTestId('won-dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByLabel(/Client legal name/)).toHaveValue(orgName) // pre-filled as on the deal page
		await expect(dialog.getByLabel(/Duration \(months\)/)).toHaveValue('12')

		await page.getByRole('button', { name: 'Cancel', exact: true }).click()
		await expect(dialog).toBeHidden()
		await expect(page.locator(`[data-column="${status}"] [data-name="${deal}"]`)).toBeVisible()
		expect((await getDoc<{ status: string }>(request, 'CRM Deal', deal)).status).toBe(status)

		await drag(page, deal, 'Won')
		await expect(dialog).toBeVisible()
		await dialog.getByLabel('Contract signed').check()
		await page.getByRole('button', { name: 'Confirm won' }).click()
		await expect(page.getByTestId('won-success')).toContainText(orgName)
		await page.getByRole('button', { name: 'Done', exact: true }).click()
		await expect(page.locator(`[data-column="Won"] [data-name="${deal}"]`)).toBeVisible()
		const doc = await getDoc<{ status: string; engagement: string }>(request, 'CRM Deal', deal)
		expect(doc.status).toBe('Won')
		expect(doc.engagement).toBeTruthy()
		const engagements = await callMethod<number>(request, 'frappe.client.get_count', { doctype: 'GAMCS Engagement', filters: { deal } })
		expect(engagements).toBe(1)
	})

	test('drop on Lost opens the Lost-reason dialog; cancel returns the card', async ({ page, request }) => {
		const deal = deals[1]
		await drag(page, deal, 'Lost')
		await expect(page.getByRole('heading', { name: 'Lost Reason' })).toBeVisible()
		await page.getByRole('button', { name: 'Cancel', exact: true }).click()
		await expect(page.locator(`[data-column="${status}"] [data-name="${deal}"]`)).toBeVisible()
		expect((await getDoc<{ status: string }>(request, 'CRM Deal', deal)).status).toBe(status)
	})
})
