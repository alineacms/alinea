import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Removable, Selectable, States} from './TagGroup.stories.js'

test('renders variants and shapes', async ({mount, page}) => {
  await mount(<Example />)
  const secondary = page.getByRole('grid', {name: 'Secondary'})
  await expect(secondary.getByRole('row', {name: 'Mint'})).toHaveAttribute(
    'data-variant',
    'secondary'
  )
  const circle = page.getByRole('grid', {name: 'Circle'})
  await expect(circle.getByRole('row', {name: 'Mint'})).toHaveAttribute(
    'data-shape',
    'circle'
  )
})

test('selects tags', async ({mount, page}) => {
  await mount(<Selectable />)
  const group = page.getByRole('grid', {name: 'Ice cream flavor'})
  await expect(group.getByRole('row', {name: 'Mint'})).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await group.getByRole('row', {name: 'Chocolate'}).click()
  await expect(page.getByTestId('state')).toHaveText('mint,chocolate')
  await expect(group.getByRole('row', {name: 'Vanilla'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
})

test('removes tags', async ({mount, page}) => {
  await mount(<Removable />)
  const group = page.getByRole('grid', {name: 'Removable'})
  await expect(group.getByRole('row')).toHaveCount(4)
  await group.getByRole('row', {name: /Mint/}).getByRole('button').click()
  await expect(group.getByRole('row')).toHaveCount(3)
  await expect(group.getByRole('row', {name: /Mint/})).toHaveCount(0)
})

test('disabled and read-only groups keep their selection', async ({
  mount,
  page
}) => {
  await mount(<States />)
  for (const name of ['Disabled', 'Read-only']) {
    const group = page.getByRole('grid', {name})
    const chocolate = group.getByRole('row', {name: 'Chocolate'})
    const mint = group.getByRole('row', {name: 'Mint'})
    await chocolate.click({force: true})
    await chocolate.focus()
    await page.keyboard.press('Space')
    await mint.focus()
    await page.keyboard.press('Space')
    await expect(chocolate).toHaveAttribute('aria-selected', 'false')
    await expect(mint).toHaveAttribute('aria-selected', 'true')
  }
})
