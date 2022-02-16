package helder.store;

import haxe.DynamicAccess;

@:genes.type('Partial<{[K in keyof T]: EV<T[K]>}>')
typedef UpdateImpl<T> = DynamicAccess<Expression.EV<Dynamic>>;

@:forward
abstract Update<T>(UpdateImpl<T>) {
  public function new(update: UpdateImpl<T>) 
    this = update;

  @:from
  public static macro function ofAny(expr: haxe.macro.Expr) {
    #if macro
    return helder.store.macro.Update.create(expr);
    #end
  }
}