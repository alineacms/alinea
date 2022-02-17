import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {store} from './DbSuite'

type User = {
  id: string
  name: {
    given: string
    last: string
  }
  email?: string
  roles?: Array<string>
}

const User = new Collection<User>('User')

test('Update', () => {
  const db = store()
  const user = db.insert(User, {
    name: {
      given: 'abc',
      last: 'test'
    }
  })
  const res = db.update(User.where(User.id.is(user.id)), {
    email: 'test'
  })
  assert.is(res.changes, 1)
  assert.is(db.first(User)!.email, 'test')
  const res2 = db.update(User.where(User.id.is(user.id)), {
    email: User.email.concat('@example.com')
  })
  assert.is(res2.changes, 1)
  assert.is(db.first(User)!.email, 'test@example.com')
  const res3 = db.update(User.where(User.id.is(user.id)), {
    name: {
      given: 'def',
      last: 'okay'
    }
  })
  assert.is(res3.changes, 1)
  assert.is(db.first(User)!.name.given, 'def')
})

test('Update object', () => {
  const db = store()
  const user = db.insert(User, {
    name: {
      given: 'abc',
      last: 'test'
    }
  })
  const res = db.update(User.where(User.id.is(user.id)), {
    name: {
      given: '123',
      last: '456'
    }
  })
  assert.is(res.changes, 1)
  const user2 = db.first(User.where(User.id.is(user.id)))!
  assert.is(user2.name.given, '123')
  assert.is(user2.name.last, '456')
})

test('Update array', () => {
  const db = store()
  const user = db.insert(User, {
    name: {
      given: 'abc',
      last: 'test'
    }
  })
  const res = db.update(User.where(User.id.is(user.id)), {
    roles: ['a', 'b']
  })
  assert.is(res.changes, 1)
  const user2 = db.first(User.where(User.id.is(user.id)))!
  assert.equal(user2.roles, ['a', 'b'])
})

test.run()
