import { test, expect } from '@playwright/test'

test('app loads and navigates core OpenTax workflow pages', async ({ page }) => {
  // 1. Welcome / landing page
  await page.goto('/')
  await expect(page.getByTestId('page-welcome')).toBeVisible()
  await expect(page.getByRole('heading', { name: /welcome.*opentax/i })).toBeVisible()

  // 2. Start the interview → first step (Filing Status)
  await page.getByRole('button', { name: /let.s start/i }).click()
  await expect(page.getByRole('heading', { name: /filing status/i })).toBeVisible()

  // 3. Navigate to Federal Review via sidebar
  await page.getByRole('link', { name: /federal review/i }).click()
  await expect(page.getByTestId('page-review')).toBeVisible()
  await expect(page.getByRole('heading', { name: /review your return/i })).toBeVisible()

  // 4. Navigate to Download via sidebar
  await page.getByRole('link', { name: /download/i }).first().click()
  await expect(page.getByTestId('page-download')).toBeVisible()
  await expect(page.getByRole('heading', { name: /download your return/i })).toBeVisible()
})
