import {Field} from './Field.js'
import {Type} from './Type.js'
import {Cursor} from './pages/Cursor.js'
import {Expand} from './util/Types.js'

type UnionOfValues<T> = T[keyof T]
type Types<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {id: string; type: K; index: string} & Type.Infer<T[K]>
  }>
>

export type Infer<T> = T extends Type<infer Fields>
  ? Type.Infer<Fields>
  : T extends Field<infer Value, any>
  ? Value
  : T extends Cursor<infer Row>
  ? Row
  : T extends Record<string, Type>
  ? Types<T>
  : never
