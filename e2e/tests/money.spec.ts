import { test, expect, APIRequestContext } from '@playwright/test'
import * as fs from 'fs'
import { callMethod, createDoc, deleteDoc, getDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 1C happy path (F4/F6/F7/F8): quarterly billing derives monthly, ACV and TCV (D34);
 * three proposal versions with approval gating (D9) and Accepted writing the deal's final value;
 * the Won dialog pre-filled from the deal (D35, D36) creating exactly one Engagement; the server
 * refusing Won without the dialog and Lost without a reason.
 */
const csrf = () => JSON.parse(fs.readFileSync('e2e/.auth/csrf.json', 'utf-8')).csrf_token as string

async function setValue(request: APIRequestContext, name: string, fieldname: string | Record<string, unknown>, value?: unknown) {
	return request.post('/api/method/frappe.client.set_value', {
		data: { doctype: 'CRM Deal', name, fieldname, value },
		headers: { 'X-Frappe-CSRF-Token': csrf() },
	})
}

test.describe('Money: commercials, proposals, Won and Lost', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	const orgName = `E2E Money Org ${id}`
	let deal = ''
	let lostDeal = ''
	let varianceDeal = ''

	test.beforeAll(async ({ request }) => {
		await createDoc(request, 'CRM Organization', { organization_name: orgName })
		const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
			organization: orgName,
			status: 'Negotiation',
			next_action_date: '2026-09-30',
			next_step: 'Close the deal',
			email: `e2e-money-${id}@example.com`,
			currency: 'INR',
			billing_frequency: 'Quarterly',
			billed_amount: 300000,
			contract_duration_months: 12,
			service_interest: [{ service: 'FP&A' }],
			expected_start_date: '2026-10-01',
		})
		deal = d.name
	})

	test.afterAll(async ({ request }) => {
		for (const name of [deal, lostDeal, varianceDeal].filter(Boolean)) {
			try {
				const doc = await getDoc<{ engagement?: string; next_action_task?: string }>(request, 'CRM Deal', name)
				if (doc.engagement) {
					await setValue(request, name, 'engagement', '')
					await deleteDoc(request, 'GAMCS Engagement', doc.engagement)
				}
				const res = await request.get(`/api/resource/GAMCS Proposal?filters=${encodeURIComponent(JSON.stringify({ deal: name }))}`)
				for (const p of ((await res.json()).data || []) as { name: string }[]) await deleteDoc(request, 'GAMCS Proposal', p.name)
				await deleteDoc(request, 'CRM Deal', name)
			} catch {
				// best-effort cleanup
			}
		}
		await deleteDoc(request, 'CRM Organization', orgName).catch(() => {})
	})

	test('quarterly billing derives monthly, ACV and TCV (D34) and the side panel shows them', async ({ request, page }) => {
		const doc = await getDoc<Record<string, number>>(request, 'CRM Deal', deal)
		expect([doc.monthly_value, doc.acv, doc.tcv, doc.deal_value, doc.expected_deal_value]).toEqual([100000, 1200000, 1200000, 1200000, 900000])
		await page.goto(`/crm/deals/${deal}`)
		await page.waitForLoadState('networkidle')
		// read-only currency fields render as disabled inputs, so look at input values, not text
		await expect
			.poll(async () => (await page.locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).filter((v) => /12,00,000|1,200,000/.test(v)).length)
			.toBeGreaterThanOrEqual(2) // ACV and TCV
	})

	test('proposal versions: approval gates Sent, Accepted writes the final value', async ({ page, request }) => {
		await page.goto(`/crm/deals/${deal}`)
		await page.waitForLoadState('networkidle')
		await page.getByRole('tab', { name: 'Proposals' }).click()
		const tab = page.getByTestId('proposals-tab')
		await tab.getByRole('button', { name: 'New proposal' }).click()
		await page.getByTestId('proposal-form').getByLabel('Amount (excl. tax)').fill('1200000')
		await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
		const v1 = tab.getByTestId('proposal-v1')
		await expect(v1).toBeVisible()

		await v1.getByRole('button', { name: 'Client status' }).click()
		await page.getByRole('menuitem', { name: 'Sent', exact: true }).click()
		await expect(page.getByText(/cannot be marked Sent/)).toBeVisible() // D9

		await v1.getByRole('button', { name: 'Approval' }).click()
		await page.getByRole('menuitem', { name: 'Approved' }).click()
		await expect(v1.getByText('Approved')).toBeVisible()
		await v1.getByRole('button', { name: 'Client status' }).click()
		await page.getByRole('menuitem', { name: 'Sent', exact: true }).click()
		await expect(v1.getByText('Sent', { exact: true })).toBeVisible()

		await tab.getByRole('button', { name: 'Revise latest' }).click()
		const amount = page.getByTestId('proposal-form').getByLabel('Amount (excl. tax)')
		await expect(amount).toHaveValue('1200000')
		await amount.fill('1100000')
		await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
		const v2 = tab.getByTestId('proposal-v2')
		await expect(v2).toBeVisible()
		await expect(v1.getByText('Revised')).toBeVisible()
		await v2.getByRole('button', { name: 'Approval' }).click()
		await page.getByRole('menuitem', { name: 'Approved' }).click()
		await v2.getByRole('button', { name: 'Client status' }).click()
		await page.getByRole('menuitem', { name: 'Accepted' }).click()
		await expect(v2.getByText('Accepted')).toBeVisible()

		// D42: the reconcile dialog opens with the one-field change that makes TCV equal the accepted amount
		const reconcile = page.getByTestId('reconcile-dialog')
		await expect(reconcile).toBeVisible()
		await expect(reconcile.getByLabel(/Billed amount per period/)).toHaveValue('275000') // 11L over four quarters
		await expect(reconcile.getByTestId('reconcile-preview')).toContainText(/11,00,000|1,100,000/)
		await page.getByRole('button', { name: 'Save structure' }).click()
		await expect(reconcile).toBeHidden()
		await expect(page.getByTestId('reconcile-banner')).toBeHidden()

		const doc = await getDoc<Record<string, number>>(request, 'CRM Deal', deal)
		expect([doc.initial_quote, doc.negotiated_quote, doc.final_value]).toEqual([1200000, 1100000, 1100000])
		expect([doc.billed_amount, doc.acv, doc.tcv, doc.needs_reconciliation]).toEqual([275000, 1100000, 1100000, 0])
	})

	test('an unreconciled accepted amount flags the deal and the server blocks Won', async ({ request }) => {
		const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
			status: 'Negotiation', next_action_date: '2026-09-30', next_step: 'x', email: `e2e-var-${id}@example.com`, currency: 'INR',
			billing_frequency: 'Monthly', billed_amount: 10000, contract_duration_months: 12,
		})
		varianceDeal = d.name
		const p = await callMethod<{ name: string }>(request, 'gamcs_crm.api.proposal.create_proposal', { deal: d.name, values: { amount: 90000, proposal_date: '2026-09-09' } })
		await callMethod(request, 'gamcs_crm.api.proposal.update_proposal', { name: p.name, values: { approval_status: 'Approved' } })
		await callMethod(request, 'gamcs_crm.api.proposal.update_proposal', { name: p.name, values: { client_status: 'Accepted' } })
		const doc = await getDoc<Record<string, number>>(request, 'CRM Deal', d.name)
		expect([doc.tcv, doc.final_value, doc.needs_reconciliation]).toEqual([120000, 90000, 1])
		const res = await request.post('/api/method/gamcs_crm.api.won.mark_won', {
			data: { deal: d.name, values: { client_legal_name: 'Var', start_date: '2026-10-01', contract_signed: 1, po_received: 0, delivery_owner: 'Administrator', account_manager: 'Administrator', service: 'FP&A' } },
			headers: { 'X-Frappe-CSRF-Token': csrf() },
		})
		expect(res.ok()).toBeFalsy()
		expect(await res.text()).toContain('Reconcile')
	})

	test('server refuses Won without the onboarding details', async ({ request }) => {
		const res = await setValue(request, deal, 'status', 'Won')
		expect(res.ok()).toBeFalsy()
		expect(await res.text()).toContain('Won dialog')
	})

	test('Won dialog is pre-filled and confirming creates one engagement', async ({ page, request }) => {
		await page.goto(`/crm/deals/${deal}`)
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: 'Negotiation' }).click()
		await page.getByRole('menuitem', { name: 'Won' }).click()
		const dialog = page.getByTestId('won-dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByLabel(/Final client name/)).toHaveValue(orgName) // D36
		await expect(dialog.getByLabel(/Final commercial/)).toHaveValue('1100000') // from the accepted proposal
		await expect(dialog.getByLabel(/Final commercial/)).toBeDisabled()
		await expect(dialog.getByLabel(/Expected annual revenue/)).toHaveValue(/11,00,000|1,100,000/) // D35, after D42 reconciliation
		await expect(dialog.getByLabel(/Contract duration/)).toHaveValue('12')
		await expect(dialog.getByText('FP&A')).toBeVisible()
		await dialog.getByLabel('Contract signed').check()
		await page.getByRole('button', { name: 'Confirm Won' }).click()
		await expect(page.getByText(/Won\. Engagement/)).toBeVisible()
		await expect(page.getByRole('button', { name: 'Won', exact: true })).toBeVisible()

		const doc = await getDoc<{ status: string; engagement: string; probability: number }>(request, 'CRM Deal', deal)
		expect([doc.status, doc.probability]).toEqual(['Won', 100])
		const eng = await getDoc<Record<string, unknown>>(request, 'GAMCS Engagement', doc.engagement)
		expect([eng.client_legal_name, eng.expected_annual_revenue, eng.final_value, eng.contract_signed, eng.po_received, eng.delivery_owner]).toEqual(
			[orgName, 1100000, 1100000, 1, 0, 'Administrator'],
		)
	})

	test('Lost needs a reason and stamps the lost date', async ({ request }) => {
		const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
			status: 'Negotiation', next_action_date: '2026-09-30', next_step: 'x', email: `e2e-lost-${id}@example.com`, currency: 'INR',
		})
		lostDeal = d.name
		const refused = await setValue(request, lostDeal, 'status', 'Lost')
		expect(refused.ok()).toBeFalsy()
		const ok = await setValue(request, lostDeal, { status: 'Lost', lost_reason: 'Price' })
		expect(ok.ok()).toBeTruthy()
		const doc = await getDoc<{ lost_date: string }>(request, 'CRM Deal', lostDeal)
		expect(doc.lost_date).toBe(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)) // site runs on Asia/Kolkata
	})
})
