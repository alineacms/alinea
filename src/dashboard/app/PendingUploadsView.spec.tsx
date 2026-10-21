import {expect, test} from '@playwright/experimental-ct-react'
import {FileTypes} from './PendingUploadsView.stories.js'

test('picks the file type an upload becomes', async ({mount, page}) => {
  await mount(<FileTypes />)
  const uploadAs = page.getByRole('button', {name: /Upload as/})
  await expect(uploadAs).toHaveText(/Photo/)
  await uploadAs.click()
  await page.getByRole('option', {name: 'Logo'}).click()
  await expect(uploadAs).toHaveText(/Logo/)
  // A file no file type takes is left out
  await expect(
    page.getByText('No file type here takes this file, it is not uploaded')
  ).toBeVisible()
  await page.getByRole('button', {name: 'Upload 1 file'}).click()
  await expect(page.locator('pre')).toContainText('"type": "Logo"')
})
