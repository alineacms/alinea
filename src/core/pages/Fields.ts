import {IsStrictlyAny, ObjectUnion} from 'alinea/core/util/Types.js'
import {Expr} from './Expr.js'

type RecordField<T> = Expr<T> & FieldsOf<ObjectUnion<T>>

// https://github.com/Microsoft/TypeScript/issues/29368#issuecomment-453529532
type Field<T> = [T] extends [Array<any>]
  ? Expr<T>
  : [T] extends [number | string | boolean]
  ? Expr<T>
  : [T] extends [Record<string, any> | null]
  ? RecordField<T>
  : Expr<T>

type FieldsOf<Row> = [Row] extends [Record<string, any>]
  ? keyof Row extends never
    ? Expr<object>
    : {[K in keyof Row]-?: Field<Row[K]>}
  : never

export type Fields<T> = IsStrictlyAny<T> extends true
  ? any
  : [T] extends [object]
  ? FieldsOf<T>
  : Field<T>
