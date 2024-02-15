import {Field} from './Field.js'
import {Type} from './Type.js'
import {Cursor} from './pages/Cursor.js'

type UnionOfValues<T> = T[keyof T]
type ListOf<T> = UnionOfValues<{
  [K in keyof T]: {_id: string; _type: K; _index: string} & Type.Infer<T[K]>
}>

export type Infer<T> = T extends Type<infer Fields>
  ? Type.Infer<Fields>
  : T extends Field<infer Value, any>
  ? Value
  : T extends Cursor<infer Row>
  ? Row
  : T extends Record<string, Type>
  ? ListOf<T>
  : never
