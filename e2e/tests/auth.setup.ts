import * as fs from 'fs'
import * as path from 'path'
import { expect, test as setup } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'
const csrfFile = 'e2e/.auth/csrf.json'

/**
 * Authentication setup - runs once before all tests.
 * Logs in via the Frappe API, captures the CSRF token, and saves storage state.
 */
setup('authenticate', async ({ page }) => {
	const authDir = path.dirname(authFile)
	if (!fs.existsSync(authDir)) {
		fs.mkdirSync(authDir, { recursive: true })
	}

	const loginResponse = await page.request.post('/api/method/login', {
		form: {
			usr: process.env.FRAPPE_USER || 'Administrator',
			pwd: process.env.FRAPPE_PASSWORD || 'admin',
		},
	})
	expect(loginResponse.ok()).toBeTruthy()

	const userResponse = await page.request.get(
		'/api/method/frappe.auth.get_logged_user',
	)
	expect(userResponse.ok()).toBeTruthy()
	const userData = await userResponse.json()
	expect(userData.message).not.toBe('Guest')
	console.log(`Authenticated as: ${userData.message}`)

	// Load the CRM app so window.frappe.csrf_token is available.
	await page.goto('/crm')
	await page.waitForLoadState('networkidle')

	// The CRM SPA injects boot keys onto window (see crm/www/crm.html),
	// so the token lives at window.csrf_token.
	const csrfToken = await page.evaluate(() => {
		const w = window as unknown as {
			csrf_token?: string
			frappe?: { csrf_token?: string }
		}
		return w.csrf_token || w.frappe?.csrf_token
	})

	// A missing token means later API writes would fail with an opaque 417;
	// fail the setup loudly instead of proceeding with no CSRF header.
	expect(csrfToken).toBeTruthy()
	fs.writeFileSync(csrfFile, JSON.stringify({ csrf_token: csrfToken }))

	await page.context().storageState({ path: authFile })

	// GAMCS 1E: a real BD login (Sales User) for the permission tests; created or reset by the Administrator session above
	const bdUser = process.env.BD_USER || 'bd-e2e@example.com'
	const bdPassword = process.env.BD_PASSWORD || 'BdE2e!2026'
	const exists = await page.request.get(`/api/resource/User/${bdUser}`)
	if (!exists.ok()) {
		const created = await page.request.post('/api/resource/User', {
			data: { email: bdUser, first_name: 'BD E2E', send_welcome_email: 0, new_password: bdPassword, roles: [{ role: 'Sales User' }] },
			headers: { 'X-Frappe-CSRF-Token': csrfToken as string },
		})
		expect(created.ok()).toBeTruthy()
	} else {
		const reset = await page.request.put(`/api/resource/User/${bdUser}`, {
			data: { new_password: bdPassword, enabled: 1 },
			headers: { 'X-Frappe-CSRF-Token': csrfToken as string },
		})
		expect(reset.ok()).toBeTruthy()
	}
	const bd = await page.context().browser()!.newContext()
	const bdPage = await bd.newPage()
	const bdLogin = await bdPage.request.post('/api/method/login', { form: { usr: bdUser, pwd: bdPassword } })
	expect(bdLogin.ok()).toBeTruthy()
	await bdPage.goto('/crm')
	await bdPage.waitForLoadState('networkidle')
	const bdCsrf = await bdPage.evaluate(() => (window as unknown as { csrf_token?: string }).csrf_token)
	fs.writeFileSync('e2e/.auth/bd-csrf.json', JSON.stringify({ csrf_token: bdCsrf, user: bdUser }))
	await bd.storageState({ path: 'e2e/.auth/bd.json' })
	await bd.close()
})
