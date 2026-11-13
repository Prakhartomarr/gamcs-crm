import { test, expect, APIRequestContext } from '@playwright/test'
import { callMethod } from '../helpers'

/**
 * GAMCS PRD §21 / F13 (E46): Settings → Notifications lists every GAMCS reminder, defaults on;
 * a toggle saves immediately for the signed-in user; Management-critical referral fee review is locked on.
 */
type Row = { key: string; enabled: boolean; forced: boolean }
const prefs = (request: APIRequestContext) => callMethod<Row[]>(request, 'gamcs_crm.api.notification_settings.get_preferences')
const stale = async (request: APIRequestContext) => (await prefs(request)).find((r) => r.key === 'stale')!

test.describe('Notification settings', () => {
	test.use({ viewport: { width: 1600, height: 900 } })

	test.afterAll(async ({ request }) => {
		await callMethod(request, 'gamcs_crm.api.notification_settings.set_preference', { key: 'stale', enabled: 1 })
	})

	test('toggling "Stale record" off and on saves for the user', async ({ page, request }) => {
		await callMethod(request, 'gamcs_crm.api.notification_settings.set_preference', { key: 'stale', enabled: 1 })
		await page.goto('/crm/leads')
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: /Administrator/ }).first().click() // user dropdown in the sidebar
		await page.getByRole('menuitem', { name: 'Settings' }).click()
		await page.locator('[data-page="Notifications"]').click()

		const panel = page.getByTestId('notification-settings')
		await expect(panel).toBeVisible()
		for (const key of ['follow_up_due', 'overdue', 'stale', 'expected_close', 'proposal_expiring', 'reconnect']) {
			await expect(panel.getByTestId(`notification-${key}`)).toBeVisible()
		}
		// Administrator is Management: referral fee review is shown, on and locked
		await expect(panel.getByTestId('notification-referral_fee').getByRole('switch')).toBeDisabled()

		const toggle = panel.getByTestId('notification-stale').getByRole('switch')
		await expect(toggle).toHaveAttribute('aria-checked', 'true')
		await toggle.click()
		await expect(toggle).toHaveAttribute('aria-checked', 'false')
		await expect.poll(async () => (await stale(request)).enabled).toBe(false)
		await toggle.click()
		await expect.poll(async () => (await stale(request)).enabled).toBe(true)
	})
})
