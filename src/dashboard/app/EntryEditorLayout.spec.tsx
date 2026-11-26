import {expect, test} from '@playwright/experimental-ct-react'
import type {Page} from 'playwright'
import {EntryEditorLayoutStory} from './EntryEditorLayout.story.js'

async function drag(page: Page, x: number) {
  const handle = page.getByRole('separator')
  const bounds = await handle.boundingBox()
  if (!bounds) throw new Error('Handle is not visible')
  const startX = bounds.x + bounds.width / 2
  const startY = bounds.y + bounds.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + x, startY, {steps: 10})
  await page.mouse.up()
}

function width(page: Page) {
  return page
    .getByRole('dialog', {name: 'Row'})
    .evaluate(element => element.getBoundingClientRect().width)
}

for (const preview of [true, false])
  test(`resizes an open sheet ${preview ? 'next to' : 'without'} the preview`, async ({
    mount,
    page
  }) => {
    await mount(<EntryEditorLayoutStory />)
    if (!preview) {
      await page.getByRole('button', {name: 'Toggle preview'}).click()
      await expect(page.getByText('Preview', {exact: true})).toBeHidden()
    }
    await page.getByRole('button', {name: 'Edit row'}).click()
    const label = page.getByRole('textbox', {name: 'Label'})
    await expect(label).toBeFocused()
    const before = await width(page)
    await drag(page, -100)
    await expect(label).toBeFocused()
    await expect.poll(() => width(page)).toBe(before + 100)
  })
