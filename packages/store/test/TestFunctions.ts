import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {Expr} from '../src/Expr'
import {Functions} from '../src/sqlite/Functions'
import {store} from './DbSuite'

const {cast, strftime} = Functions

test('Functions', () => {
  const db = store()
  const User = new Collection<{id: string; birthdate: string}>('User')
  const now = '1920-01-01'
  const age: Expr<number> = cast(strftime('%Y', now), 'integer')
    .substract(cast(strftime('%Y', User.birthdate), 'integer'))
    .substract(
      cast(
        strftime('%m-%d', now).less(strftime('%m-%d', User.birthdate)),
        'integer'
      )
    )
  const me = db.insert(User, {birthdate: '1900-01-01'})
  assert.is(db.first(User.select({age: age}).where(User.id.is(me.id)))!.age, 20)
})

test.run()
