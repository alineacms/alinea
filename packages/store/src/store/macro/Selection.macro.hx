package helder.store.macro;

function fieldFromType(type: Type) {
  return switch type {
    case TAnonymous(_.get() => {fields: fields}):
      final fields = [for (field in fields)
        ({
          name: field.name,
          kind: FVar(fieldFromType(field.type)),
          access: [APublic],
          pos: field.pos
        }: Field)
      ];
      return TAnonymous(fields);
    case TAbstract(_.get() => {
      module: 'helder.store.Expression', 
      name: 'Expression'
    }, [t]):
      return t.toComplexType();
    case TInst(_.get() => {
      module: 'helder.store.Cursor',
      name: 'Cursor'
    }, [t]):
      final complex = t.toComplexType();
      return (macro: Array<$complex>);
    case TInst(_.get() => {
      module: 'helder.store.Cursor',
      name: 'CursorSingleRow'
    }, [t]):
      return t.toComplexType();
    case TAbstract(_.get() => {
      module: 'helder.store.Selection',
      name: 'Selection'
    }, [t]):
      return t.toComplexType();
    case t:
      return t.toComplexType();
  }
}

function create(expr: Expr) {
  final type = fieldFromType(Context.typeof(expr));
  return macro @:pos(expr.pos) (
    new helder.store.Selection.SelectionImpl(
      helder.store.Selection.SelectionImpl.create($expr)
    ): 
    helder.store.Selection<$type>
  );
}