import {EntryRow, EntryTable} from 'alinea/core/EntryRow'
import {Realm} from 'alinea/core/pages/Realm'
import {Table} from 'rado'

interface ResolveContextData {
  realm: Realm
  location: Array<string>
  locale: string | undefined
  depth: number
  expr: ExprContext
}

enum ExprContext {
  InNone = 0,
  InSelect = 1 << 0,
  InCondition = 1 << 1,
  InAccess = 1 << 2
}

export class ResolveContext {
  table: Table<EntryTable>
  constructor(private data: Partial<ResolveContextData>) {
    this.table = EntryRow().as(`E${this.depth}`)
  }

  linkContext() {
    return new ResolveContext({
      realm: this.realm
    })
  }

  get depth() {
    return this.data.depth ?? 0
  }
  get location() {
    return this.data.location ?? []
  }
  get realm() {
    return this.data.realm ?? Realm.Published
  }
  get locale() {
    return this.data.locale
  }
  get expr() {
    return this.data.expr ?? ExprContext.InNone
  }

  get Table() {
    return this.table
  }

  increaseDepth(): ResolveContext {
    return new ResolveContext({...this.data, depth: this.depth + 1})
  }

  decreaseDepth(): ResolveContext {
    return new ResolveContext({...this.data, depth: this.depth - 1})
  }

  get isInSelect() {
    return this.expr & ExprContext.InSelect
  }
  get isInCondition() {
    return this.expr & ExprContext.InCondition
  }
  get isInAccess() {
    return this.expr & ExprContext.InAccess
  }

  get select(): ResolveContext {
    if (this.isInSelect) return this
    return new ResolveContext({
      ...this.data,
      expr: this.expr | ExprContext.InSelect
    })
  }
  get condition(): ResolveContext {
    if (this.isInCondition) return this
    return new ResolveContext({
      ...this.data,
      expr: this.expr | ExprContext.InCondition
    })
  }
  get access(): ResolveContext {
    if (this.isInAccess) return this
    return new ResolveContext({
      ...this.data,
      expr: this.expr | ExprContext.InAccess
    })
  }
  get none(): ResolveContext {
    return new ResolveContext({
      ...this.data,
      expr: this.expr | ExprContext.InNone
    })
  }
}
