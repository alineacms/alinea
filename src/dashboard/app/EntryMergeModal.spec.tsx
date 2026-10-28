import {expect, test} from '@playwright/experimental-ct-react'
import {Draft, Publish} from './EntryMergeModal.stories.js'

test('resolves fields both editors changed', async ({mount, page}) => {
  await mount(<Draft />)
  await expect(
    page.getByText('Sam saved this page while you were editing')
  ).toBeVisible()
  await expect(
    page.getByText('Merged automatically: Intro, Tags')
  ).toBeVisible()
  const title = page.getByRole('radiogroup', {name: 'Keep for Title'})
  await expect(title.getByRole('radio', {name: 'Yours'})).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect(page.getByText('Spring sale starts Monday')).toBeVisible()
  await title.getByRole('radio', {name: 'Theirs'}).click()
  await expect(page.getByText('Spring sale', {exact: true})).toBeVisible()
  const body = page.getByRole('radiogroup', {name: 'Keep for Body'})
  await expect(body.getByRole('radio', {name: 'Merge'})).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await body.getByRole('radio', {name: 'Yours'}).click()
  await page.getByRole('button', {name: 'Apply and save draft'}).click()
  await expect(page.locator('pre')).toHaveText(
    '{"title":"theirs","body":"yours"}'
  )
})

test('discards my changes or publishes', async ({mount, page}) => {
  await mount(<Publish />)
  await expect(
    page.getByRole('button', {name: 'Apply and publish'})
  ).toBeVisible()
  await page.getByRole('button', {name: 'Discard my changes'}).click()
  await expect(page.locator('pre')).toHaveText('Discarded')
})
