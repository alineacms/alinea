import {expect, spyOn, test} from 'bun:test'
import {uploadError} from './Forms.js'

test('an upload to a route without put explains itself', async () => {
  const error = spyOn(console, 'error').mockImplementation(() => {})
  try {
    const refused = new Response('', {status: 405})
    expect(await uploadError(refused)).toBe('The file could not be uploaded')
    expect(error).toHaveBeenCalledTimes(1)
    const large = new Response('The file is larger than said', {status: 413})
    expect(await uploadError(large)).toBe('The file is larger than said')
  } finally {
    error.mockRestore()
  }
})
