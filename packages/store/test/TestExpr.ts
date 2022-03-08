import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Expr, ExprData} from '../src/Expr'
import {Formatter} from '../src/Formatter'
import {From} from '../src/From'
import {sql, Statement} from '../src/Statement'

class TestFormatter extends Formatter {
  escape = (value: any) => value
  escapeId = (id: string) => id
  formatAccess = (on: Statement, field: string) =>
    sql`${on}.${Statement.raw(field)}`
  formatField = (from: From, field: string) => Statement.raw(`$.${field}`)
  formatUnwrapArray = (sql: Statement) => sql
}

const formatter = new TestFormatter()

function f(expr: Expr<any>) {
  return formatter.formatExpr(expr.expr, {formatInline: true}).sql
}
function field(field: string) {
  return new Expr(ExprData.Field(undefined!, field))
}

test('basic', () => {
  assert.is(f(Expr.value(1).is(1)), '(1 = 1)')
  assert.is(f(field('a').is(1)), '($.a = 1)')
  assert.is(
    f(field('a').is(1).and(field('b').is(2))),
    '(($.a = 1) and ($.b = 2))'
  )
})

test('path', () => {
  assert.is(f(field('a.b').is(1)), '($.a.b = 1)')
})

test.run()
