import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Stack.stories.js'

test('lays out rows and columns with a gap', async ({mount, page}) => {
  await mount(<Example />)
  const cancel = (await page
    .getByRole('button', {name: 'Cancel'})
    .boundingBox())!
  const save = (await page.getByRole('button', {name: 'Save'}).boundingBox())!
  expect(save.y).toBe(cancel.y)
  expect(save.x - (cancel.x + cancel.width)).toBe(8)
  const title = (await page
    .getByRole('textbox', {name: 'Title'})
    .boundingBox())!
  const path = (await page.getByRole('textbox', {name: 'Path'}).boundingBox())!
  expect(path.y).toBeGreaterThan(title.y + title.height)
})
