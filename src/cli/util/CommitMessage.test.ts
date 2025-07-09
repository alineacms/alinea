import {suite} from '@alinea/suite'
import {} from 'alinea/core'
import {parseCoAuthoredBy} from './CommitMessage.js'

const test = suite(import.meta)

test('parse author', () => {
  const message1 =
    'Alinea content update\n\nCo-authored-by: Ben <ben@example.com>'
  const author = parseCoAuthoredBy(message1)
  test.equal(author, {
    name: 'Ben',
    email: 'ben@example.com'
  })
})
