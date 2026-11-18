import {suite} from '@alinea/suite'
import {type Heartbeat, lockExpiry, lockTimeout, nextLock} from './EditLock.js'

const test = suite(import.meta)

const ada = {sub: 'ada', name: 'Ada'}
const bob = {sub: 'bob', name: 'Bob'}
const entry = {entryId: 'page', locale: null}
const x: Heartbeat = {...entry, session: 'x'}
const y: Heartbeat = {...entry, session: 'y'}

test('the first editor holds the entry, the next one sees who', () => {
  const [held, first] = nextLock(undefined, x, ada, 0)
  test.equal(first, {holds: true})
  const [, second] = nextLock(held, y, bob, 1000)
  test.equal(second, {holds: false, holder: {user: ada, idle: 1000}})
})

test('the holder allows a request', () => {
  const [held] = nextLock(undefined, x, ada, 0)
  const [asked, waiting] = nextLock(held, {...y, ask: true}, bob, 1000)
  test.equal(waiting.request, {user: bob, mine: true, remaining: lockTimeout})
  const [allowed, answer] = nextLock(asked, {...x, answer: 'allow'}, ada, 2000)
  test.equal(answer.holds, false)
  test.equal(answer.holder?.user, bob)
  const [, granted] = nextLock(allowed, {...y, ask: true}, bob, 3000)
  test.equal(granted, {holds: true})
})

test('the holder declines a request', () => {
  const [held] = nextLock(undefined, x, ada, 0)
  const [asked, prompt] = nextLock(held, {...y, ask: true}, bob, 1000)
  test.is(prompt.holds, false)
  const [, holder] = nextLock(asked, x, ada, 2000)
  test.equal(holder.request?.user, bob)
  const [declined] = nextLock(asked, {...x, answer: 'decline'}, ada, 2000)
  const [after, told] = nextLock(declined, {...y, ask: true}, bob, 3000)
  test.is(told.declined, true)
  test.is(told.request, undefined)
  // Asking again is a new request
  const [, again] = nextLock(after, {...y, ask: true}, bob, 4000)
  test.is(again.request?.mine, true)
})

test('control passes when the holder does not answer in time', () => {
  const [held] = nextLock(undefined, x, ada, 0)
  const [asked] = nextLock(held, {...y, ask: true}, bob, 1000)
  const [still] = nextLock(asked, x, ada, 1000 + lockTimeout - 1)
  const [, early] = nextLock(
    still,
    {...y, ask: true},
    bob,
    1000 + lockTimeout - 1
  )
  test.is(early.holds, false)
  const [passed, late] = nextLock(
    still,
    {...y, ask: true},
    bob,
    1000 + lockTimeout
  )
  test.equal(late, {holds: true})
  const [, back] = nextLock(passed, x, ada, 2000 + lockTimeout)
  test.equal(back.holder?.user, bob)
})

test('a holder that stops sending heartbeats loses the entry', () => {
  const [held] = nextLock(undefined, x, ada, 0)
  const [, status] = nextLock(held, y, bob, lockExpiry)
  test.equal(status, {holds: true})
})

test('a store that lost its locks is claimed again', () => {
  const [, status] = nextLock(undefined, x, ada, 5000)
  test.equal(status, {holds: true})
})

test('the same user takes over from another tab right away', () => {
  const [held] = nextLock(undefined, x, ada, 0)
  const [, tab] = nextLock(held, y, ada, 1000)
  test.equal(tab.holder?.user, ada)
  const [, taken] = nextLock(held, {...y, ask: true}, ada, 1000)
  test.equal(taken, {holds: true})
})

test('leaving frees the entry and drops the request', () => {
  const [held] = nextLock(undefined, x, ada, 0)
  const [asked] = nextLock(held, {...y, ask: true}, bob, 1000)
  const [withdrawn] = nextLock(asked, {...y, leave: true}, bob, 2000)
  test.equal(withdrawn?.request, undefined)
  const [left] = nextLock(held, {...x, leave: true}, ada, 2000)
  test.is(left, undefined)
})

test('a second request waits for the first', () => {
  const z: Heartbeat = {...entry, session: 'z', ask: true}
  const [held] = nextLock(undefined, x, ada, 0)
  const [asked] = nextLock(held, {...y, ask: true}, bob, 1000)
  const [kept, status] = nextLock(asked, z, {sub: 'cy'}, 2000)
  test.equal(status.request, {
    user: bob,
    mine: false,
    remaining: lockTimeout - 1000
  })
  test.is(kept?.request?.session, 'y')
})
