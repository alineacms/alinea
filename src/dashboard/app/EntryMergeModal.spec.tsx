import {expect, test} from '@playwright/experimental-ct-react'
import {ListsAndRichText, Publish} from './EntryMergeModal.stories.js'

test('resolves fields both editors changed', async ({mount, page}) => {
  await mount(<ListsAndRichText />)
  await expect(
    page.getByText('Sam saved this page while you were editing')
  ).toBeVisible()
  await expect(
    page.getByText(/Merged automatically: Intro, Tags/)
  ).toBeVisible()
  const title = page.getByRole('radiogroup', {name: 'Title'})
  // Both values show, yours is kept unless the editor picks theirs
  await expect(title.getByText('Spring sale starts Monday')).toBeVisible()
  await expect(title.getByText('Spring sale', {exact: true})).toBeVisible()
  await expect(title.getByRole('radio', {name: 'Yours'})).toBeChecked()
  await title.getByText("Sam's").click()
  await expect(title.getByRole('radio', {name: "Sam's"})).toBeChecked()
  const body = page.getByRole('radiogroup', {name: 'Body'})
  await expect(body.getByRole('radio', {name: 'Combine both'})).toBeChecked()
  await body.getByText('Yours', {exact: true}).click()
  const sections = page.getByRole('radiogroup', {name: 'Sections'})
  await expect(sections.getByText('3 items')).toBeVisible()
  await expect(sections.getByText('4 items')).toBeVisible()
  await page.getByRole('button', {name: 'Apply and save draft'}).click()
  await expect(page.locator('pre')).toHaveText(
    '{"title":"theirs","body":"yours","sections":"merge"}'
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
