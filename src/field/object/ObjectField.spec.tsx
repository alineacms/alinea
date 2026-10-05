import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './ObjectField.stories.js'

test('folds an object field under its label', async ({mount, page}) => {
  await mount(<Example />)
  const box = page.getByRole('list', {name: 'Open Graph'})
  await expect(page.getByText('A fixed group of related fields')).toBeVisible()
  await expect(box.getByRole('listitem')).toContainText(
    'Build structured pages'
  )
  const title = box.getByRole('textbox', {name: 'Title'})
  await title.fill('Share card')
  await expect(box.getByRole('listitem')).toContainText('Share card')
  await box.getByRole('button', {name: 'Collapse Open Graph'}).click()
  await expect(title).toBeHidden()
  await box.getByRole('button', {name: 'Expand Open Graph'}).click()
  await expect(title).toHaveValue('Share card')
})
