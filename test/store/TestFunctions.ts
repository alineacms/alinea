import {Collection} from 'alinea/store/Collection'
import {Expr} from 'alinea/store/Expr'
import {SqliteFunctions} from 'alinea/store/sqlite/SqliteFunctions'
import {test} from 'uvu'
import * as assert from 'uvu/assert'
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
