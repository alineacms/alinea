import {act, cleanup, render} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {StrictMode} from 'react'
import {PreviewAction} from './PreviewMessage.js'
import {usePreview} from './react.js'

afterEach(cleanup)

test('applies a payload once when strict mode registers twice', async () => {
  const pings: Array<unknown> = []
  const host = {
    closed: false,
    postMessage(message: {action: string}) {
      if (message.action === PreviewAction.Ping) pings.push(message)
    }
  }
  const opener = Object.getOwnPropertyDescriptor(window, 'opener')
  Object.defineProperty(window, 'opener', {value: host, configurable: true})
  const applied: Array<string> = []
  function Preview() {
    usePreview({
      hostOrigin: location.origin,
      async preview(update) {
        applied.push(update.payload)
      }
    })
    return null
  }
  try {
    render(
      <StrictMode>
        <Preview />
      </StrictMode>
    )
    expect(pings.length).toBe(2)
    // The host answers every ping with the current payload
    const send = (payload: string) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {action: PreviewAction.Preview, payload},
          origin: location.origin,
          source: host as unknown as Window
        })
      )
    await act(async () => {
      send('first')
      send('first')
    })
    expect(applied).toEqual(['first'])
    await act(async () => send('second'))
    expect(applied).toEqual(['first', 'second'])
  } finally {
    if (opener) Object.defineProperty(window, 'opener', opener)
    else delete (window as {opener?: unknown}).opener
  }
})
