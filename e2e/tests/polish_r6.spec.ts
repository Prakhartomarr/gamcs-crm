import { test, expect, Page } from '@playwright/test'
import { createDoc, deleteDoc, seedLead, uniqueSuffix } from '../helpers'

/**
 * GAMCS UI round 6 (ui-work/UI_REVIEW.md, round 5 leftovers): an unpriced deal reads "—" in the deals
 * list, list headers are sentence case, side-panel placeholders meet 4.5:1 in light and dark, and the
 * dashboard number cards share the follow-up cards' right edge on phones.
 */

function lum(c: number[]) {
	const f = (v: number) => {
		v /= 255
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
	}
	return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function contrast(a: number[], b: number[]) {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
	return (x + 0.05) / (y + 0.05)
}

/** Ink and background of an element, sampled from its pixels (works for ::placeholder too). */
async function inkOn(page: Page, buf: Buffer) {
	return page.evaluate(async (b64) => {
		const img = new Image()
		img.src = 'data:image/png;base64,' + b64
		await img.decode()
		const c = document.createElement('canvas')
		c.width = img.width
		c.height = img.height
		const x = c.getContext('2d')!
		x.drawImage(img, 0, 0)
		const d = x.getImageData(0, 0, c.width, c.height).data
		const bg = [d[0], d[1], d[2]]
		let ink = bg
		let best = -1
		for (let i = 0; i < d.length; i += 4) {
			const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2])
			if (dist > best) {
				best = dist
				ink = [d[i], d[i + 1], d[i + 2]]
			}
		}
		return { bg, ink }
	}, buf.toString('base64'))
}

test.describe('UI round 6 polish', () => {
	test('an unpriced deal shows a dash in the ACV column', async ({ page }) => {
		const id = uniqueSuffix()
		const org = `E2E Unpriced Org ${id}`
		await createDoc(page.request, 'CRM Organization', { organization_name: org })
		const deal = await createDoc<{ name: string }>(page.request, 'CRM Deal', {
			organization: org,
			status: 'New Opportunity',
			next_action_date: '2026-12-31',
			next_step: 'Discovery call',
			email: `e2e-unpriced-${id}@example.com`,
		})
		try {
			await page.setViewportSize({ width: 1600, height: 900 })
			await page.goto('/crm/deals/view/list')
			await expect(page.getByText('ACV (excl. tax)', { exact: true }).first()).toBeVisible()
			const rowEl = page.getByRole('link').filter({ hasText: org }).first() // list rows are links
			await expect(rowEl).toBeVisible()
			await expect(rowEl).toContainText('—')
			await expect(rowEl).not.toContainText('0.00')
		} finally {
			await deleteDoc(page.request, 'CRM Deal', deal.name)
		}
	})

	test('list column headers are sentence case', async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 })
		await page.goto('/crm/leads/view/list')
		await expect(page.getByText('Full name', { exact: true }).first()).toBeVisible()
		await expect(page.getByText('Last modified', { exact: true }).first()).toBeVisible()
		await expect(page.getByText('Full Name', { exact: true })).toHaveCount(0)
		await expect(page.getByText('Mobile No.', { exact: true })).toHaveCount(0)
	})

	for (const theme of ['light', 'dark']) {
		test(`side panel placeholders meet 4.5:1 (${theme})`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 })
			const lead = (await seedLead(page.request)).name
			try {
				await page.goto(`/crm/leads/${lead}`)
				await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
				const field = page
					.locator('.field')
					.filter({ has: page.locator('.truncate', { hasText: /^Company Description$/ }) })
					.first()
				const box = field.locator('textarea').first()
				await expect(box).toHaveAttribute('placeholder', /Company Description/)
				await page.waitForTimeout(300)
				const { ink, bg } = await inkOn(page, await box.screenshot())
				expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5)
			} finally {
				await deleteDoc(page.request, 'CRM Lead', lead)
			}
		})
	}

	test('dashboard number cards line up with the follow-up cards on a phone', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 })
		await page.goto('/crm/dashboard')
		const kpi = page.locator('[data-testid="dashboard-greeting"] .gamcs-card').nth(1)
		const num = page.locator('.gamcs-chart-surface').first()
		await expect(kpi).toBeVisible({ timeout: 30000 }) // the dashboard loads its charts after the shell
		await expect(num).toBeVisible({ timeout: 30000 })
		const [k, n, k0] = [await kpi.boundingBox(), await num.boundingBox(), await page.locator('[data-testid="dashboard-greeting"] .gamcs-card').first().boundingBox()]
		expect(Math.abs(k!.x + k!.width - (n!.x + n!.width))).toBeLessThanOrEqual(0.5)
		expect(Math.abs(k0!.x - n!.x)).toBeLessThanOrEqual(0.5)
	})
})
