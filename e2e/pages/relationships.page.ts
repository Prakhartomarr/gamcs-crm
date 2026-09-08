import { Page, expect } from '@playwright/test'

/**
 * GAMCS: Relationships list/Kanban (/crm/relationships) and the detail page.
 * Link fields in the quick-entry dialog render as an Autocomplete whose closed
 * state is a button carrying the field label as placeholder; opening it shows a
 * search input, and options are listed by name.
 */
export class RelationshipsPage {
	constructor(private page: Page) {}

	async goto() {
		await this.page.goto('/crm/relationships')
		await this.page.waitForLoadState('networkidle')
	}

	async gotoKanban() {
		await this.page.goto('/crm/relationships/view/kanban')
		await this.page.waitForLoadState('networkidle')
	}

	async gotoDetail(name: string) {
		await this.page.goto(`/crm/relationships/${name}`)
		await this.page.waitForLoadState('networkidle')
	}

	async openCreateModal() {
		await this.page.getByRole('button', { name: 'Create', exact: true }).click()
		await expect(
			this.page.getByRole('heading', { name: 'Create Relationship' }),
		).toBeVisible()
	}

	/** Pick a value in a Link/Select autocomplete inside the dialog. */
	private async pickLink(placeholder: string, value: string) {
		const dialog = this.page.getByRole('dialog')
		await dialog.getByRole('button', { name: placeholder, exact: true }).click()
		const search = this.page.getByPlaceholder('Search', { exact: false }).last()
		if (await search.count()) await search.fill(value)
		await this.page.getByRole('option', { name: value, exact: false }).first().click()
	}

	/** Fill organization + type (stage/owner are defaulted) and submit. */
	async createRelationship(organization: string, relationshipType: string) {
		await this.pickLink('Organization', organization)
		await this.pickLink('Relationship Type', relationshipType)
		await this.page
			.getByRole('dialog')
			.getByRole('button', { name: 'Create', exact: true })
			.click()
		await expect(
			this.page.getByRole('heading', { name: 'Create Relationship' }),
		).toBeHidden()
		await this.page.waitForURL(/\/crm\/relationships\/GAMCS-REL-/)
		return this.page.url().split('/').pop() as string
	}

	/** The onboarding panel opens on top of the board for new users; get it out of the way. */
	async dismissOnboarding() {
		const skip = this.page.getByRole('button', { name: 'Skip all' })
		if (await skip.count()) await skip.click()
	}

	/** Drag a Kanban card onto a stage column (Sortable needs the drop inside the column's list). */
	async dragToStage(name: string, stage: string) {
		const card = this.page.locator(`[data-name="${name}"]`)
		const column = this.page.locator(`[data-column="${stage}"]`)
		await card.scrollIntoViewIfNeeded()
		await column.scrollIntoViewIfNeeded()
		await card.dragTo(column, { targetPosition: { x: 60, y: 60 } })
	}

	async openTab(name: string) {
		await this.page.getByRole('tab', { name }).click()
	}

	/** Post a comment: the bottom-bar "Comment" button opens the editor; submit carries a shortcut hint. */
	async addComment(text: string) {
		await this.openTab('Comments')
		await this.page.getByRole('button', { name: 'Comment', exact: true }).click()
		const editor = this.page.locator('[contenteditable="true"]').last()
		await editor.click()
		await editor.fill(text)
		await this.page.getByRole('button', { name: /^Comment\s*\(.*\)$/ }).click()
	}
}
