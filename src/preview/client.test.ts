import '#test/react.js'
import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test'
import {mountPreviews, type PreviewRefreshDetail} from './client.js'
import {PreviewAction} from './PreviewMessage.js'

interface HappyWindow {
  happyDOM: {setURL(url: string): void}
}

const dashboardOrigin = 'https://cms.test'
const host = {
  closed: false,
  postMessage: mock(() => {}),
  get location(): Location {
    throw new Error('Cross-origin')
  }
}
let unmount: (() => void) | undefined
let reload: ReturnType<typeof spyOn>

beforeEach(() => {
  ;(window as unknown as HappyWindow).happyDOM.setURL('https://site.test/page')
  Object.defineProperty(window, 'opener', {value: host, configurable: true})
  reload = spyOn(window.location, 'reload').mockImplementation(() => {})
  sessionStorage.clear()
})

afterEach(() => {
  unmount?.()
  reload.mockRestore()
  Object.defineProperty(window, 'opener', {value: null, configurable: true})
})

function mount() {
  unmount = mountPreviews({dashboardUrl: `${dashboardOrigin}/admin.html`})
}

function sendPreview(payload: string) {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: host as unknown as Window,
      origin: dashboardOrigin,
      data: {action: PreviewAction.Preview, payload}
    })
  )
}

function nextRefresh() {
  return new Promise<CustomEvent<PreviewRefreshDetail>>(resolve =>
    addEventListener('alinea:refresh', resolve, {once: true})
  )
}

test('frameworks refresh the page by canceling the refresh event', async () => {
  mount()
  const refresh = nextRefresh()
  // Frameworks cancel the event while it is dispatched
  addEventListener('alinea:refresh', event => event.preventDefault(), {
    once: true
  })
  sendPreview('first')
  const event = await refresh
  event.detail.done()
  expect(event.defaultPrevented).toBe(true)
  expect(document.cookie).toContain('first')
  expect(reload).not.toHaveBeenCalled()
})

test('the page reloads when nobody refreshes it', async () => {
  mount()
  const refresh = nextRefresh()
  sendPreview('second')
  await refresh
  expect(reload).toHaveBeenCalledTimes(1)
  expect(JSON.parse(sessionStorage.getItem('alinea:preview')!).payload).toBe(
    'second'
  )
})

test('the reloaded page does not refresh for the preview it shows', async () => {
  sessionStorage.setItem(
    'alinea:preview',
    JSON.stringify({payload: 'third', x: 0, y: 0})
  )
  mount()
  const refreshed = mock(() => {})
  addEventListener('alinea:refresh', refreshed)
  sendPreview('third')
  await new Promise(resolve => setTimeout(resolve, 10))
  removeEventListener('alinea:refresh', refreshed)
  expect(refreshed).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('alinea:preview')).toBeNull()
})
