package helder.store.macro;

function getProp(expr: Expr, property: String) {
  final type = switch Context.typeof(expr) {
    case TAbstract(_, [_.toComplexType() => t]):
      if (t == null) 
        Context.error('Cannot type this expression, does the collection it belongs to lack a type?', expr.pos);
      Context
        .typeof(macro @:pos(expr.pos) (null: $t).$property)
        .toComplexType();
    default: null;
  }
  return if (type != null)
    macro @:pos(expr.pos) (
      $expr.get($v{property}): helder.store.Expression<$type>
    )
  else macro @:pos(expr.pos) null;
}