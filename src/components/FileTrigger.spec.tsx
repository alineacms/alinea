import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Images} from './FileTrigger.stories.js'

test('opens the file browser from its child', async ({mount, page}) => {
  await mount(<Example />)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Upload files'}).click()
  const fileChooser = await chooser
  expect(fileChooser.isMultiple()).toBe(true)
  await fileChooser.setFiles([
    {name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('a')},
    {name: 'b.txt', mimeType: 'text/plain', buffer: Buffer.from('b')}
  ])
  await expect(page.getByTestId('files').getByRole('listitem')).toHaveText([
    'a.txt',
    'b.txt'
  ])
})

test('passes accept and multiple to the input', async ({mount, page}) => {
  await mount(<Images />)
  const input = page.locator('[data-slot="file-trigger-input"]')
  await expect(input).toHaveAttribute('accept', 'image/png,image/jpeg')
  await expect(input).not.toHaveAttribute('multiple')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', {name: 'Pick an image'}).click()
  await (
    await chooser
  ).setFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('png')
  })
  await expect(page.getByTestId('file')).toHaveText('photo.png')
})
