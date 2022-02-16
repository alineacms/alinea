package helder.store.macro;

function create(expr: Expr) {
  final updateType = Context.typeof(expr);
  final expectedType = Context.getExpectedType();
  return switch expectedType {
    case TAbstract(_, [_.toComplexType() => row]):
      switch Context.followWithAbstracts(updateType) {
        case TAnonymous(_.get() => {fields: fields}):
          final checks = [];
          // Type each fields corresponding to the Row
          for (field in fields) {
            final property = field.name;
            final type = Context
              .typeof(macro @:pos(field.pos) (null: $row).$property)
              .toComplexType();
            final unifies =
              Context.unify(field.type, (macro:helder.store.Expression.EV<$type>).toType());
            if (!unifies) {
              final asValue = type.toString().replace('StdTypes.', '');
              final asExpr = 'helder.store.Expression<$asValue>';
              Context.error(
                '${field.type.toString()} should be ${asValue} or ${asExpr}', 
                field.pos
              );
            }
          }
          final ret = expectedType.toComplexType();
          return macro @:pos(expr.pos) (cast $expr: $ret);
        default:
          Context.error('Expected anonymous', expr.pos);
      }
    default:
      Context.error('Expected helder.store.Update type', expr.pos);
  }
}