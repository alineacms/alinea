import {expect, spyOn, test} from 'bun:test'
import {uploadFile} from './Forms.js'

const file = new Blob(['%PDF-1.4'], {type: 'application/pdf'})
const ticket = {url: 'https://example.com/api?token=x', method: 'PUT'} as const

async function answer(response: Response | Error, locale?: string) {
  const respond = async () => {
    if (response instanceof Error) throw response
    return response
  }
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(respond, {preconnect: globalThis.fetch.preconnect})
  )
  const error = spyOn(console, 'error').mockImplementation(() => {})
  try {
    const message = await uploadFile(ticket, file, locale)
    return {message, logged: error.mock.calls.length}
  } finally {
    fetch.mockRestore()
    error.mockRestore()
  }
}

test('an upload that passes has no message', async () => {
  expect(await answer(new Response(null, {status: 204}))).toEqual({
    message: undefined,
    logged: 0
  })
})

test('an upload the handler refused shows its reason', async () => {
  const refused = Response.json(
    {error: 'Upload het bestand opnieuw'},
    {status: 409}
  )
  expect(await answer(refused)).toEqual({
    message: 'Upload het bestand opnieuw',
    logged: 0
  })
})

test('an upload to a route without put explains itself', async () => {
  expect(await answer(new Response('', {status: 405}))).toEqual({
    message: 'The file could not be uploaded',
    logged: 1
  })
})

test('an error page of the host is not shown to visitors', async () => {
  const host = new Response('Request Entity Too Large', {status: 413})
  expect(await answer(host, 'nl')).toEqual({
    message: 'Het bestand kon niet worden geüpload',
    logged: 1
  })
})

test('an upload the browser could not send shows an error', async () => {
  // Eg. a handler on another origin whose route does not answer OPTIONS
  const blocked = new TypeError('Failed to fetch')
  expect(await answer(blocked, 'nl')).toEqual({
    message: 'Het bestand kon niet worden geüpload',
    logged: 1
  })
})
