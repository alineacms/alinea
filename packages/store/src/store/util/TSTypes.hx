package helder.store.util;

import helder.store.Expression;
import helder.store.Selection;
import helder.store.Cursor;

typedef E<T> = ExpressionImpl<T>;
typedef S<T> = SelectionImpl<T>;
typedef C<T> = Cursor<T>;
typedef CSR<T> = CursorSingleRow<T>;

@:genes.type('
  | E<any>
  | S<any>
  | {[key: string]: TSSelect | C<any>}
')
typedef TSSelect = {};

@:genes.type('
  T extends S<infer K> ? K :
  T extends CSR<infer K> ? K :
  T extends C<infer K> ? Array<K> :
  T extends E<infer K> ? K :
  T extends {[key: string]: TSSelect | C<any>} 
    ? {[K in keyof T]: TSTypeOf<T[K]>}
    : any
')
typedef TSTypeOf<T> = {};

@:genes.type('<X extends TSSelect>(select: X) => C<TSTypeOf<X>>')
typedef CursorSelect = {};

@:genes.type('<X extends TSSelect>(select: X) => S<Omit<T, keyof TSTypeOf<X>> & TSTypeOf<X>>')
typedef TSWith<T> = Dynamic;