import { test, expect } from '@playwright/test'
import { callMethod, createDoc, deleteDoc, getDoc, getList, uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 2 L3: generate the proposal PDF from the GAMCS template, send it for signature
 * (copy-link, no outgoing email account on dev), open the link as a guest, sign, and check the
 * version is Accepted with the signed PDF (certificate page) attached. Plus the guard that the
 * public route leaks nothing for a bad token.
 */
test.describe('Proposal generation and e-signature', () => {
	test.use({ viewport: { width: 1600, height: 900 } })
	const id = uniqueSuffix()
	const orgName = `E2E Sign Org ${id}`
	let deal = ''
	let proposal = ''

	test.beforeAll(async ({ request }) => {
		await createDoc(request, 'CRM Organization', { organization_name: orgName })
		const d = await createDoc<{ name: string }>(request, 'CRM Deal', {
			organization: orgName,
			status: 'Negotiation',
			next_action_date: '2026-12-30',
			next_step: 'Get the proposal signed',
			email: `e2e-sign-${id}@example.com`,
			currency: 'INR',
			billing_frequency: 'Monthly',
			billed_amount: 50000,
			contract_duration_months: 12,
		})
		deal = d.name
		const p = await callMethod<{ name: string }>(request, 'gamcs_crm.api.proposal.create_proposal', {
			deal,
			values: { amount: 600000, validity_days: 30, scope: 'Monthly MIS and a board pack.' },
		})
		proposal = p.name
		await callMethod(request, 'gamcs_crm.api.proposal.update_proposal', { name: proposal, values: { approval_status: 'Approved' } })
	})

	test.afterAll(async ({ request }) => {
		try {
			for (const r of await getList<{ name: string }>(request, 'GAMCS Signature Request', { filters: { deal } }))
				await deleteDoc(request, 'GAMCS Signature Request', r.name)
			await deleteDoc(request, 'GAMCS Proposal', proposal)
			await deleteDoc(request, 'CRM Deal', deal)
			await deleteDoc(request, 'CRM Organization', orgName)
		} catch {
			// best-effort cleanup
		}
	})

	test('generate, send for signature, sign as a guest, proposal accepted', async ({ page, request, browser }) => {
		await page.goto(`/crm/deals/${deal}`)
		await page.waitForLoadState('networkidle')
		await page.getByRole('tab', { name: 'Proposals' }).click()
		const row = page.getByTestId('proposal-v1')
		await row.getByTestId('proposal-generate').click()
		await expect(row.getByRole('link', { name: 'PDF', exact: true })).toBeVisible()
		const generated = await getDoc<{ document: string; document_generated_on: string }>(request, 'GAMCS Proposal', proposal)
		expect(generated.document).toContain('.pdf')
		expect(generated.document_generated_on).toBeTruthy()

		await callMethod(request, 'gamcs_crm.api.proposal.update_proposal', { name: proposal, values: { client_status: 'Sent' } })
		await page.reload()
		await page.waitForLoadState('networkidle')
		await page.getByRole('tab', { name: 'Proposals' }).click()
		await row.getByTestId('proposal-send-signature').click()
		await page.getByRole('button', { name: 'Create signing link' }).click()
		const linkBox = page.getByTestId('sign-link')
		await expect(linkBox).toBeVisible()
		const link = await linkBox.inputValue()
		expect(link).toMatch(/\/sign#[\w-]{40,}$/)
		await page.getByRole('button', { name: 'Done' }).click()
		await expect(row.getByTestId('proposal-signature')).toHaveText('Awaiting signature')

		// the client: no session
		const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } })
		const client = await guest.newPage()
		const path = link.replace(/^https?:\/\/[^/]+/, '')
		await client.goto(path)
		await expect(client.getByTestId('sign-page')).toBeVisible()
		await expect(client.getByText(orgName)).toBeVisible()
		expect(await client.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex')
		expect(client.url()).not.toContain('#') // the token leaves the address bar
		await client.getByTestId('sign-name').fill('Priya Sharma')
		await client.getByTestId('sign-consent').check()
		await client.getByTestId('sign-submit').click()
		await expect(client.getByText('Thank you, the proposal is signed')).toBeVisible({ timeout: 30000 })
		await guest.close()

		const signed = await getDoc<{ client_status: string; signed_document: string; signature_request: string }>(request, 'GAMCS Proposal', proposal)
		expect(signed.client_status).toBe('Accepted')
		expect(signed.signed_document).toContain('signed.pdf')
		const req = await getDoc<{ status: string; signer_name: string; signed_sha256: string; document_sha256: string }>(
			request, 'GAMCS Signature Request', signed.signature_request)
		expect(req.status).toBe('Signed')
		expect(req.signer_name).toBe('Priya Sharma')
		expect(req.document_sha256).toMatch(/^[0-9a-f]{64}$/)
		const pdf = await request.get(signed.signed_document)
		expect(pdf.ok()).toBeTruthy()
		expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
		const d = await getDoc<{ final_value: number }>(request, 'CRM Deal', deal)
		expect(d.final_value).toBe(600000)

		await page.reload()
		await page.waitForLoadState('networkidle')
		await page.getByRole('tab', { name: 'Proposals' }).click()
		await expect(row.getByTestId('proposal-signed-pdf')).toBeVisible()
		await expect(row.getByTestId('proposal-signature')).toHaveText('Signed by Priya Sharma')
	})

	test('the public route leaks nothing for a bad token', async ({ browser }) => {
		const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } })
		const page = await guest.newPage()
		await page.goto('/sign#not-a-real-token-but-long-enough-to-look-like-one-xxxx')
		await expect(page.getByTestId('sign-state')).toContainText('not valid')
		await expect(page.getByTestId('sign-page')).toBeHidden()
		const res = await page.request.post('/api/method/gamcs_crm.api.esign.get_signing_view', {
			data: { token: 'not-a-real-token' },
		})
		expect(res.headers()['x-robots-tag']).toContain('noindex')
		const body = await res.json()
		expect(Object.keys(body.message).sort()).toEqual(['message', 'ok', 'reason'])
		expect(body.message.ok).toBe(false)
		expect(JSON.stringify(body)).not.toMatch(/GAMCS-PROP|CRM-DEAL|pdf|E2E Sign Org/)
		await guest.close()
	})
})
