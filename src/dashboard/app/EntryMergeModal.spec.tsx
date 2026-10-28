import {expect, test} from '@playwright/experimental-ct-react'
import {
  LinksAndImages,
  ListsAndRichText,
  ManyFields,
  Publish
} from './EntryMergeModal.stories.js'

test('resolves fields both editors changed', async ({mount, page}) => {
  await mount(<ListsAndRichText />)
  await expect(
    page.getByText('Sam saved this page while you were editing')
  ).toBeVisible()
  await expect(page.getByText(/Merged automatically: Intro/)).toBeVisible()
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
  await expect(sections.getByText('3 items')).toHaveCount(2)
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

test('reviews the changes to a list and goes back', async ({mount, page}) => {
  await mount(<ListsAndRichText />)
  await page
    .getByRole('listitem')
    .filter({hasText: 'Sections'})
    .getByRole('button', {name: 'Review changes'})
    .click()
  await expect(page.getByRole('heading', {name: 'Sections'})).toBeVisible()
  const yours = page.getByRole('region', {name: 'Yours'})
  await expect(
    yours.getByRole('listitem').filter({hasText: 'Opening hours'})
  ).toContainText('Changed')
  const theirs = page.getByRole('region', {name: "Sam's"})
  await expect(
    theirs.getByRole('listitem').filter({hasText: 'Section 2'})
  ).toContainText('Removed')
  await expect(
    theirs.getByRole('listitem').filter({hasText: 'Section 4'})
  ).toContainText('Added')
  const choices = page.getByRole('radiogroup', {name: 'Sections'})
  await choices.getByText("Sam's").click()
  await page.getByRole('button', {name: 'All fields'}).click()
  await expect(choices.getByRole('radio', {name: "Sam's"})).toBeChecked()
  await page.getByRole('button', {name: 'Apply and save draft'}).click()
  await expect(page.locator('pre')).toHaveText(
    '{"title":"yours","body":"merge","sections":"theirs"}'
  )
})

test('keeps the header and footer in view with many fields', async ({
  mount,
  page
}) => {
  await page.setViewportSize({width: 390, height: 700})
  await mount(<ManyFields />)
  const apply = page.getByRole('button', {name: 'Apply and save draft'})
  await expect(apply).toBeInViewport()
  await page
    .getByRole('radiogroup', {name: 'Sections'})
    .scrollIntoViewIfNeeded()
  await expect(apply).toBeInViewport()
  await expect(
    page.getByText('Sam saved this page while you were editing')
  ).toBeInViewport()
})

test('renders values through their fields', async ({mount, page}) => {
  await mount(<LinksAndImages />)
  const featured = page.getByRole('radiogroup', {name: 'Featured'})
  await expect(featured.getByText('Yes', {exact: true})).toBeVisible()
  await expect(featured.getByText('No', {exact: true})).toBeVisible()
  const link = page.getByRole('radiogroup', {name: 'Link'})
  await expect(link.getByText('About us')).toBeVisible()
  await expect(link.getByText('Spring sale on example.com')).toBeVisible()
  // A single link or image is yours or theirs, a list of links combines
  await expect(link.getByRole('radio')).toHaveCount(2)
  const image = page.getByRole('radiogroup', {name: 'Image'})
  await expect(image.getByText('Ferns on a shelf')).toBeVisible()
  await expect(image.getByText('Empty')).toBeVisible()
  const related = page.getByRole('radiogroup', {name: 'Related pages'})
  await expect(related.getByRole('radio')).toHaveCount(3)
  await expect(related.getByText('Contact')).toBeVisible()
})
