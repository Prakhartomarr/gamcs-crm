import { test, expect } from '@playwright/test'
import { callMethod, createDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS E65: deal page qualification + documents, the 8-field kanban card, Settings → Masters,
 * and the Engagement page (onboarding checklist + billed revenue).
 */
test.describe('E65 pipeline extras and engagements', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	const orgName = `E2E E65 Org ${id}`
	let deal = ''

	test.beforeAll(async ({ request }) => {
		await createDoc(request, 'CRM Organization', { organization_name: orgName })
		const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
			organization: orgName, status: 'New Opportunity', next_action_date: '2000-01-03', next_step: `Call CFO ${id}`,
			currency: 'INR', email: `e2e-e65-${id}@example.com`, billing_frequency: 'Monthly', billed_amount: 100000,
			contract_duration_months: 12, budget_known: 1, website: 'example.com', decision_maker: 'CFO', first_name: 'Asha', last_name: 'Rao',
		})
		deal = d.name
	})

	test('deal page shows qualification, contact line and documents', async ({ page }) => {
		await page.goto(`/crm/deals/${deal}`)
		await expect(page.getByTestId('qualification')).toHaveText(/Qualification 2 of 5/)
		await page.getByTestId('qualification').click()
		await expect(page.getByText('Decision maker identified')).toBeVisible()
		await expect(page.getByTestId('header-contact')).toHaveText(/Asha Rao/)
		await expect(page.getByTestId('documents')).toBeVisible()
		await expect(page.getByTestId('contact-website')).toHaveText('example.com')
	})

	test('kanban card shows the money line and an overdue next action', async ({ page }) => {
		await page.goto('/crm/deals/view/kanban')
		const card = page.locator(`[data-name="${deal}"]`)
		await card.scrollIntoViewIfNeeded()
		await expect(card.getByTestId('kanban-money')).toHaveText(/₹12,00,000 · 10%/)
		const next = card.getByTestId('kanban-next-action')
		await expect(next).toContainText(`Call CFO ${id}`)
		await expect(next.locator('.gamcs-pill-yellow')).toContainText('overdue')
		await expect(card.getByTestId('kanban-contact')).toHaveText('Asha Rao')
	})

	test('admin adds and removes a service in Settings → Masters', async ({ page, request }) => {
		const name = `E2E Service ${id}`
		await page.goto('/crm/deals')
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: /Administrator/ }).first().click()
		await page.getByRole('menuitem', { name: 'Settings' }).click()
		await page.locator('[data-page="Lists"]').click()
		const panel = page.getByTestId('masters-lists')
		await panel.getByTestId('master-tab-services').click()
		await expect(panel.locator('[data-name="FP&A"]')).toBeVisible() // rows (and the add form) reloaded
		await panel.getByTestId('master-new-title').fill(name)
		await panel.getByTestId('master-add-button').click()
		await expect(panel.locator(`[data-name="${name}"]`)).toBeVisible()
		await expect.poll(() => callMethod<number>(request, 'frappe.client.get_count', { doctype: 'GAMCS Service', filters: { name } })).toBe(1)
		await callMethod(request, 'gamcs_crm.api.masters.delete_row', { master: 'services', name })
		await page.locator('[data-page="Stages"]').click()
		const stages = page.getByTestId('masters-stages')
		await stages.getByTestId('master-tab-deal_stages').click()
		await expect(stages.locator('[data-name="Negotiation"]')).toBeVisible()
	})

	test('won deal gets an engagement with a checklist and billed revenue', async ({ page, request }) => {
		await callMethod(request, 'gamcs_crm.api.won.mark_won', {
			deal,
			values: {
				client_legal_name: `${orgName} Pvt Ltd`, final_value: 1200000, start_date: '2026-12-01', contract_signed: 1, po_received: 0,
				delivery_owner: 'Administrator', account_manager: 'Administrator', service: 'FP&A',
			},
		})
		const eng = (await callMethod<{ name: string }>(request, 'frappe.client.get_value', {
			doctype: 'CRM Deal', filters: deal, fieldname: 'engagement',
		})) as unknown as { engagement: string }
		await page.goto(`/crm/engagements/${eng.engagement}`)
		await expect(page.getByTestId('engagement-title')).toHaveText(`${orgName} Pvt Ltd`)
		const progress = page.getByTestId('onboarding-progress')
		await expect(progress).toHaveText(/^1 of \d+ done$/)
		await page.getByRole('checkbox', { name: 'PO received' }).check()
		await expect(progress).toHaveText(/^2 of \d+ done$/)
		const form = page.getByTestId('revenue-form')
		await form.locator('input[type="month"]').fill('2026-12')
		await form.locator('input[type="number"]').fill('100000')
		await form.getByRole('button', { name: 'Save month' }).click()
		await expect(page.getByTestId('revenue')).toContainText('₹1,00,000')
		await page.goto('/crm/engagements')
		await expect(page.getByTestId('engagements-list')).toContainText(`${orgName} Pvt Ltd`)
	})
})
