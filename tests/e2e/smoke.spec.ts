import { test, expect } from '@playwright/test'

test('app loads and navigates core OpenTax workflow pages', async ({ page }) => {
  await page.goto('/intake')

  await expect(page.getByRole('heading', { name: 'OpenTax MVP' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Intake Uploads' })).toBeVisible()

  await page.getByRole('link', { name: /Guided Interview/ }).click()
  await expect(page.getByRole('heading', { name: 'Guided Interview' })).toBeVisible()

  await page.getByRole('link', { name: /Compute \+ Explain/ }).click()
  await expect(page.getByRole('heading', { name: 'Compute + Explain' })).toBeVisible()

  await page.getByRole('link', { name: /Review \/ Print/ }).click()
  await expect(page.getByRole('heading', { name: 'Review + Print Checklist' })).toBeVisible()
})
