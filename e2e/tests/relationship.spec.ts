import { test, expect } from '@playwright/test'
import { RelationshipsPage } from '../pages/relationships.page'
import { createDoc, deleteDoc, getDoc, uniqueSuffix } from '../helpers'

/**
 * GAMCS Phase 1A happy path (F1): create a partner relationship, move it across
 * two Kanban stages, log an activity that lands in the timeline, create an
 * opportunity sourced by it and see the roll-up count it.
 */
test.describe('Partner relationship happy path', () => {
	test.use({ viewport: { width: 1600, height: 900 } }) // the board is wide; keep drop targets on screen
	const id = uniqueSuffix()
	const orgName = `E2E CPA ${id}`
	let relationship = ''
	let deal = ''

	test.beforeAll(async ({ request }) => {
		await createDoc(request, 'CRM Organization', { organization_name: orgName })
	})

	test.afterAll(async ({ request }) => {
		for (const [dt, name] of [
			['CRM Deal', deal],
			['GAMCS Relationship', relationship],
			['CRM Organization', orgName],
		] as const) {
			if (!name) continue
			try {
				await deleteDoc(request, dt, name)
			} catch {
				// best-effort cleanup
			}
		}
	})

	test('relationship lifecycle', async ({ page, request }) => {
		const rel = new RelationshipsPage(page)

		// 1. create from the list page
		await rel.goto()
		await rel.openCreateModal()
		relationship = await rel.createRelationship(orgName, 'CPA / Accounting Firm')
		expect(relationship).toMatch(/^GAMCS-REL-/)
		await expect(page.getByText(orgName).first()).toBeVisible()

		// 2. move across two Kanban stages: Identified -> Contacted -> Connected
		await rel.gotoKanban()
		await rel.dismissOnboarding()
		await rel.dragToStage(relationship, 'Contacted')
		await expect
			.poll(async () => (await getDoc(request, 'GAMCS Relationship', relationship)).stage)
			.toBe('Contacted')
		await rel.dragToStage(relationship, 'Connected')
		await expect
			.poll(async () => (await getDoc(request, 'GAMCS Relationship', relationship)).stage)
			.toBe('Connected')

		// 3. log an activity (comment) and see it in the timeline
		const note = `E2E LinkedIn touch ${id}`
		await rel.gotoDetail(relationship)
		await rel.addComment(note)
		await rel.openTab('Activity')
		await expect(page.getByText(note).first()).toBeVisible()
		// the stage changes are in the timeline too
		await expect(page.getByText('Connected').first()).toBeVisible()

		// 4. an opportunity sourced by this partner shows in the roll-up
		const created = await createDoc<{ name: string }>(request, 'CRM Deal', {
			organization: orgName,
			sourced_by_relationship: relationship,
			currency: 'INR',
			deal_value: 250000,
		})
		deal = created.name
		await rel.gotoDetail(relationship)
		await expect(page.getByTestId('rollup-count')).toHaveText('1')
		await expect(page.getByTestId('rollup-deal').first()).toContainText(orgName)
	})
})
