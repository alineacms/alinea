import {expect, test} from '@playwright/experimental-ct-react'
import type {Page} from 'playwright'
import {Disabled, Example, Images} from './DropZone.stories.js'

async function dropFiles(page: Page, files: Array<[string, string]>) {
  const zone = page.locator('[data-slot="drop-zone"]')
  // Synthetic DataTransfer objects expose neither allowed operations nor
  // file entries, so dispatch drag events with a minimal stand-in
  const dispatch = (type: string) =>
    zone.evaluate(
      (
        element,
        {type, files}: {type: string; files: Array<[string, string]>}
      ) => {
        const items = files.map(([name, mime]) => {
          const file = new File(['content'], name, {type: mime})
          return {kind: 'file', type: mime, getAsFile: () => file}
        })
        const dataTransfer = {
          items,
          types: ['Files'],
          effectAllowed: 'all',
          dropEffect: 'none',
          getData: () => ''
        }
        const event = new DragEvent(type, {bubbles: true, cancelable: true})
        Object.defineProperty(event, 'dataTransfer', {value: dataTransfer})
        element.dispatchEvent(event)
      },
      {type, files}
    )
  await dispatch('dragenter')
  await dispatch('dragover')
  await expect(zone).toHaveAttribute('data-drag-over', 'true')
  await dispatch('drop')
}

test('picks files with the trigger', async ({mount, page}) => {
  await mount(<Example />)
  await page
    .locator('[data-slot="drop-zone"] input[type="file"]')
    .setInputFiles([
      {name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('a')},
      {name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('b')}
    ])
  await expect(page.getByTestId('files').getByRole('listitem')).toHaveText([
    'a.txt',
    'b.txt'
  ])
})

test('receives dropped files', async ({mount, page}) => {
  await mount(<Example />)
  await dropFiles(page, [['dropped.pdf', 'application/pdf']])
  await expect(page.getByTestId('files')).toHaveText('dropped.pdf')
  await expect(page.locator('[data-slot="drop-zone"]')).not.toHaveAttribute(
    'data-drag-over'
  )
})

test('ignores files that are not accepted', async ({mount, page}) => {
  await mount(<Images />)
  const input = page.locator('[data-slot="drop-zone"] input[type="file"]')
  await expect(input).toHaveAttribute('accept', 'image/png,image/jpeg')
  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('x')
  })
  await expect(page.getByRole('img')).toHaveCount(0)
})

test('disables the trigger', async ({mount, page}) => {
  await mount(<Disabled />)
  await expect(page.getByRole('button', {name: 'Browse files'})).toBeDisabled()
  await expect(page.locator('[data-slot="drop-zone"]')).toHaveAttribute(
    'data-disabled',
    'true'
  )
})
