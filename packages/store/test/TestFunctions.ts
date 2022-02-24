import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {Expr} from '../src/Expr'
import {SqliteFunctions} from '../src/sqlite/SqliteFunctions'
import {store} from './DbSuite'

const {cast, strftime} = SqliteFunctions

test('Functions', () => {
  const db = store()
  const User = new Collection<{id: string; birthdate: string}>('User')
  const now = '1920-01-01'
  const int = (e: Expr<any>) => cast(e, 'integer')
  const age: Expr<number> = int(strftime('%Y', now))
    .substract(int(strftime('%Y', User.birthdate)))
    .substract(
      int(strftime('%m-%d', now).less(strftime('%m-%d', User.birthdate)))
    )
  const me = db.insert(User, {birthdate: '1900-01-01'})
  assert.is(db.first(User.select({age: age}).where(User.id.is(me.id)))!.age, 20)
})

test.run()
