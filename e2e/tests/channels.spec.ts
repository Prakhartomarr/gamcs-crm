import { test, expect } from '@playwright/test'
import { callMethod, createDoc, deleteDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 2 L3: WhatsApp and LinkedIn are logged by hand (no Business API, D15/D16). The header
 * quick action opens the quick-log pre-set to the channel; the icon link opens wa.me with the number
 * in E.164 (+91 default). Guard: upstream's WhatsApp UI stays hidden while frappe_whatsapp is absent.
 */
test.describe('WhatsApp and LinkedIn quick actions', () => {
	test.use({ viewport: { width: 1440, height: 900 } })
	const id = uniqueSuffix()
	let lead = ''
	// unique per run: F11 duplicate detection matches on the phone number
	const ten = '9' + String(Date.now()).slice(-9)

	test.beforeAll(async ({ request }) => {
		const l = await createDoc<{ name: string }>(request, 'CRM Lead', {
			first_name: 'Channel',
			last_name: `E2E ${id}`,
			status: 'New',
			mobile_no: `${ten.slice(0, 5)} ${ten.slice(5)}`,
			linkedin: 'linkedin.com/in/channel-e2e',
			next_action_date: '2026-12-30',
		})
		lead = l.name
	})

	test.afterAll(async ({ request }) => {
		const acts = await callMethod<{ name: string }[]>(request, 'frappe.client.get_list', {
			doctype: 'GAMCS Activity', filters: { reference_docname: lead }, fields: ['name'],
		}).catch(() => [])
		for (const a of acts) await deleteDoc(request, 'GAMCS Activity', a.name).catch(() => {})
		await deleteDoc(request, 'CRM Lead', lead).catch(() => {}) // best effort
	})

	test('WhatsApp quick action logs a WhatsApp touch; links open the chat and profile', async ({ page, request }) => {
		await page.goto(`/crm/leads/${lead}`)
		await page.waitForLoadState('networkidle')
		const summary = page.getByTestId('record-summary')
		await expect(summary.getByTestId('open-whatsapp')).toHaveAttribute('href', `https://wa.me/91${ten}`)
		await expect(summary.getByTestId('open-whatsapp')).toHaveAttribute('target', '_blank')
		await expect(summary.getByTestId('open-linkedin')).toHaveAttribute('href', 'https://linkedin.com/in/channel-e2e')

		await summary.getByTestId('log-whatsapp').click()
		const dialog = page.getByTestId('quick-log')
		await expect(dialog.getByRole('radio', { name: 'WhatsApp' })).toHaveAttribute('aria-checked', 'true')
		await dialog.getByLabel('Subject').fill('Sent the deck on WhatsApp')
		await page.getByRole('button', { name: 'Log activity' }).last().click()
		await expect(dialog).toBeHidden()
		const acts = await callMethod<{ activity_type: string }[]>(request, 'frappe.client.get_list', {
			doctype: 'GAMCS Activity',
			filters: { reference_docname: lead },
			fields: ['activity_type'],
		})
		expect(acts.map((a) => a.activity_type)).toContain('WhatsApp')

		await summary.getByTestId('log-linkedin').click()
		await expect(page.getByTestId('quick-log').getByRole('radio', { name: 'LinkedIn' })).toHaveAttribute('aria-checked', 'true')
		await page.getByRole('button', { name: 'Cancel' }).click()
	})

	test('upstream WhatsApp UI is hidden while frappe_whatsapp is not installed', async ({ page, request }) => {
		for (const m of ['is_whatsapp_installed', 'is_whatsapp_enabled']) {
			const res = await request.get(`/api/method/crm.api.whatsapp.${m}`)
			expect((await res.json()).message, m).toBe(false)
		}
		await page.goto(`/crm/leads/${lead}`)
		await page.waitForLoadState('networkidle')
		await expect(page.getByRole('tab', { name: 'WhatsApp' })).toHaveCount(0)
		await page.goto('/crm/follow-ups')
		await page.waitForLoadState('networkidle')
		await expect(page.getByText('WhatsApp Templates')).toHaveCount(0)
	})
})
