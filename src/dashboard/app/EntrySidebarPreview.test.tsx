import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {atom, Provider} from 'jotai'
import {EntrySidebarBrowserPreview} from './EntrySidebarPreview.js'

afterEach(cleanup)

test('shows a loader while the preview URL is pending', () => {
  const localeData = {
    previewUrlState: atom([true, undefined] as const),
    retryPreviewUrl: atom(null, () => {})
  }

  render(
    <Provider>
      <EntrySidebarBrowserPreview localeData={localeData} />
    </Provider>
  )

  expect(
    screen.getByRole('progressbar', {name: 'Loading preview'})
  ).toBeDefined()
  expect(screen.queryByText('Preview is currently unavailable.')).toBeNull()
})

test('requests a new token when reloading before the preview handshake', () => {
  let retries = 0
  const localeData = {
    previewUrlState: atom([false, 'about:blank'] as const),
    retryPreviewUrl: atom(null, () => {
      retries++
    })
  }
  render(
    <Provider>
      <EntrySidebarBrowserPreview localeData={localeData} />
    </Provider>
  )

  fireEvent.click(screen.getByRole('button', {name: 'Reload preview'}))

  expect(retries).toBe(1)
})
