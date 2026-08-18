import {expect, test} from '@playwright/experimental-ct-react'
import {
  EntryPickerSingle,
  Example,
  ImagePickerSingle
} from './LinkField.stories.js'

test('opens the standalone image picker story', async ({mount, page}) => {
  await mount(<ImagePickerSingle />)

  await page.getByRole('button', {name: 'Pick an image'}).click()

  await expect(page.getByRole('dialog', {name: 'Pick an image'})).toBeVisible()
  await expect(
    page.getByRole('treegrid', {name: 'Media folders'})
  ).toBeVisible()
  await expect(page.getByRole('searchbox', {name: 'Search'})).toBeFocused()
})

test('switches link picker workspaces and roots', async ({mount, page}) => {
  await mount(<EntryPickerSingle />)
  await page.getByRole('button', {name: 'Pick an entry'}).click()

  await page.getByRole('button', {name: 'Simple'}).click()
  await page.getByRole('menuitemradio', {name: 'Deeply nested'}).click()
  await expect(page.getByText('Docs', {exact: true})).toBeVisible()

  await page.getByRole('button', {name: 'Pages'}).click()
  await page.getByRole('menuitemradio', {name: 'Media'}).click()
  await expect(
    page.getByRole('button', {name: 'Media', exact: true})
  ).toBeVisible()

  await page.getByRole('button', {name: 'Deeply nested'}).click()
  await page.getByRole('menuitemradio', {name: 'Simple'}).click()
  await expect(page.getByRole('button', {name: 'Simple'})).toBeVisible()
})

test('keeps a link selected while filtering the picker', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerSingle />)
  await page.getByRole('button', {name: 'Pick an entry'}).click()

  const search = page.getByRole('searchbox', {name: 'Search'})
  await expect(search).toBeFocused()
  await page.getByRole('row', {name: /^Home /}).click()
  await expect(page.getByText('1 item selected')).toBeVisible()

  await search.fill('About')
  await expect(page.getByText('About', {exact: true})).toBeVisible()
  await expect(page.getByText('1 item selected')).toBeVisible()
})

test('truncates long link labels', async ({mount, page}) => {
  await mount(<Example />)
  const label = page.getByText('Alinea documentation', {exact: true})

  const overflow = await label.evaluate(element => {
    element.textContent =
      'Alinea documentation with an intentionally very long navigation label'
    const style = getComputedStyle(element)
    return {
      clipped: element.scrollWidth > element.clientWidth,
      maxWidth: style.maxWidth,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace
    }
  })

  expect(overflow).toEqual({
    clipped: true,
    maxWidth: '240px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  })
})
