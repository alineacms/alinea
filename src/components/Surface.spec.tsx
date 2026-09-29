import {expect, type MountResult, test} from '@playwright/experimental-ct-react'
import {Basic, Nested, Rows} from './Surface.stories.js'

type Locator = ReturnType<MountResult['locator']>

function background(locator: Locator) {
  return locator.evaluate(element => getComputedStyle(element).backgroundColor)
}

test('nested surfaces alternate their background', async ({mount, page}) => {
  await mount(<Nested />)
  const base = await background(
    page.getByRole('region', {name: 'Base surface'})
  )
  const nested = await background(
    page.getByRole('region', {name: 'Nested surface'})
  )
  const deeper = await background(
    page.getByRole('region', {name: 'Deeper surface'})
  )
  expect(nested).not.toBe(base)
  expect(deeper).toBe(base)
})

test('an explicit depth sets the background', async ({mount, page}) => {
  await mount(<Basic />)
  const muted = page.getByRole('region', {name: 'Muted surface'})
  await expect(muted).toHaveAttribute('data-depth', 'muted')
  const base = await background(
    page.getByRole('region', {name: 'Workspace settings'})
  )
  expect(await background(muted)).not.toBe(base)
})

test('rows are separated by a border', async ({mount, page}) => {
  await mount(<Rows />)
  const rows = page.getByRole('list', {name: 'Sections'}).getByRole('listitem')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toHaveCSS('border-top-width', '0px')
  await expect(rows.nth(1)).toHaveCSS('border-top-width', '1px')
  await expect(rows.nth(2)).toHaveCSS('border-top-width', '1px')
})
