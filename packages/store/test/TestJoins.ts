import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {store} from './DbSuite'

type Entry = {
  id: string
  type: string
  num: number
}

test('OrderBy', () => {
  const db = store()
  const User = new Collection<{id: string; name: string}>('user')
  const Contact = new Collection<{id: string; user: string}>('contact')
  const user1 = db.insert(User, {name: 'b'})
  const user2 = db.insert(User, {name: 'a'})
  const contact1 = db.insert(Contact, {user: user1.id})
  const contact2 = db.insert(Contact, {user: user2.id})
  const results = db.all(
    Contact.leftJoin(User, User.id.is(Contact.user))
      .select(Contact.with({user: User.fields}))
      .orderBy(User.name.asc())
  )
  assert.is(results[0].user.name, 'a')
  assert.is(results[1].user.name, 'b')
})

test('Cursor joins', () => {
  const db = store()
  const Entry = new Collection<Entry>('Entry')
  const Type1 = new Collection<Entry>('Entry', {
    where: Entry.as('Type1').type.is('Type1'),
    alias: 'Type1'
  })
  const Type2 = new Collection<Entry>('Entry', {
    where: Entry.as('Type2').type.is('Type2'),
    alias: 'Type2'
  })
  db.insert(Entry, {type: 'Type1', num: 1})
  db.insert(Entry, {type: 'Type2', num: 1})
  db.insert(Entry, {type: 'Type3', num: 1})
  const res = db.first(
    Type1.leftJoin(Type2, Type1.num.is(Type2.num)).select(
      Type1.fields.with({
        linked: Type2.fields
      })
    )
  )!
  assert.is(res.linked.type, 'Type2')
})

test.run()
