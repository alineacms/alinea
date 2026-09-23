import {expect, test} from '@playwright/experimental-ct-react'
import {Determinate, Example} from './Spinner.stories.js'

test('indeterminate spinners are labelled progress bars', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await expect(
    page.getByRole('progressbar', {name: 'Loading', exact: true})
  ).toHaveCount(2)
  const named = page.getByRole('progressbar', {name: 'Loading entries'})
  await expect(named).toHaveAttribute('data-size', 'default')
  await expect(named).not.toHaveAttribute('aria-valuenow')
})

test('determinate spinners expose their value', async ({mount, page}) => {
  await mount(<Determinate />)
  const uploading = page.getByRole('progressbar', {name: 'Uploading'})
  await expect(uploading).toHaveAttribute('aria-valuenow', '25')
  await expect(uploading).toHaveAttribute('aria-valuemax', '100')
  await expect(uploading).not.toHaveAttribute('data-indeterminate')
})
