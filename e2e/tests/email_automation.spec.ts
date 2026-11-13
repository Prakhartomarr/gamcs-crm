import { test, expect, APIRequestContext } from '@playwright/test'
import { callMethod, cleanupE2ERecords, createDoc, getDoc, getList, seedLead } from '../helpers'

/**
 * GAMCS E56 / E57: enrol a lead in a follow-up sequence from its page, and schedule an Outlook meeting
 * with Microsoft Graph stubbed server-side (GAMCS Email Settings → test mode, honoured on dev sites only).
 */
const SETTINGS = 'GAMCS Email Settings'
const SEQUENCE = 'E2E onboarding nudges'

async function setSettings(request: APIRequestContext, values: Record<string, unknown>) {
	await callMethod(request, 'frappe.client.set_value', { doctype: SETTINGS, name: SETTINGS, fieldname: values })
}

async function ensureSequence(request: APIRequestContext) {
	const existing = await getList(request, 'GAMCS Email Sequence', { filters: { name: SEQUENCE }, fields: ['name'] })
	if (existing.length) return
	for (const n of [1, 2]) {
		const name = `E2E sequence step ${n}`
		const found = await getList(request, 'Email Template', { filters: { name }, fields: ['name'] })
		if (!found.length)
			await createDoc(request, 'Email Template', { name, subject: `Step ${n}`, response: `Hello {{ first_name }}, step ${n}.`, enabled: 1 })
	}
	await createDoc(request, 'GAMCS Email Sequence', {
		sequence_name: SEQUENCE,
		applies_to: 'Leads and opportunities',
		steps: [
			{ email_template: 'E2E sequence step 1', delay_days: 0 },
			{ email_template: 'E2E sequence step 2', delay_days: 3 },
		],
	})
}

test.describe('Email automation on the lead page', () => {
	test.use({ viewport: { width: 1600, height: 900 } })

	test.afterEach(async ({ request }) => {
		await setSettings(request, { calendar_sync_enabled: 0, graph_test_mode: 0 })
	})

	test.afterAll(async ({ request }) => {
		await cleanupE2ERecords(request)
	})

	test('enrols a lead in a sequence and un-enrols it', async ({ page, request }) => {
		await ensureSequence(request)
		const lead = await seedLead(request)
		await page.goto(`/crm/leads/${lead.name}`)
		await page.waitForLoadState('networkidle')

		const tools = page.getByTestId('email-tools')
		await tools.getByTestId('start-sequence').click()
		const dialog = page.getByTestId('sequence-dialog')
		await expect(dialog).toBeVisible()
		await dialog.getByTestId(`sequence-option-${SEQUENCE}`).click()
		await page.getByTestId('sequence-enrol').click()

		const status = tools.getByTestId('sequence-status')
		await expect(status).toContainText(`In sequence: ${SEQUENCE}`)
		await expect(status).toContainText('0 of 2 sent')
		const rows = await getList<{ status: string; recipient: string }>(request, 'GAMCS Sequence Enrolment', {
			filters: { reference_doctype: 'CRM Lead', reference_docname: lead.name },
			fields: ['status', 'recipient'],
		})
		expect(rows).toEqual([{ status: 'Active', recipient: lead.email }])

		await status.getByTestId('sequence-unenrol').click()
		await expect(tools.getByTestId('sequence-ended')).toContainText('it was un-enrolled')
		await expect(tools.getByTestId('start-sequence')).toBeVisible()
	})

	test('schedules a meeting through the stubbed Graph and moves the next action', async ({ page, request }) => {
		await setSettings(request, { calendar_sync_enabled: 1, graph_test_mode: 1, teams_meetings: 1 })
		const lead = await seedLead(request)
		await page.goto(`/crm/leads/${lead.name}`)
		await page.waitForLoadState('networkidle')

		await page.getByTestId('email-tools').getByTestId('schedule-meeting').click()
		const dialog = page.getByTestId('meeting-dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByTestId('meeting-attendees')).toHaveValue(lead.email!)
		await dialog.getByTestId('meeting-subject').fill('E2E discovery call')
		// frappe-ui date / time pickers: type into the trigger input and confirm with Enter
		for (const [id, value] of [['meeting-date', '2026-12-15'], ['meeting-time', '10:30']]) {
			const input = dialog.getByTestId(id).locator('input').first()
			await input.click()
			await input.fill(value)
			await input.press('Enter')
		}
		await dialog.getByTestId('meeting-subject').click() // close any open picker
		await page.getByTestId('meeting-submit').click()
		await expect(page.getByText('is in your Outlook calendar')).toBeVisible()

		const events = await getList<{ event_id: string; join_url: string; source: string }>(request, 'GAMCS Calendar Event', {
			filters: { reference_doctype: 'CRM Lead', reference_docname: lead.name },
			fields: ['event_id', 'join_url', 'source'],
		})
		expect(events).toHaveLength(1)
		expect(events[0].event_id).toMatch(/^stub-/)
		expect(events[0].join_url).toContain('teams.microsoft.com')
		const doc = await getDoc<{ next_action_date: string; next_action_type: string }>(request, 'CRM Lead', lead.name)
		expect(doc.next_action_date).toBe('2026-12-15')
		expect(doc.next_action_type).toBe('Meeting')
		// the Meeting activity is on the timeline
		await page.reload()
		await expect(page.getByText('E2E discovery call').first()).toBeVisible()
	})
})
