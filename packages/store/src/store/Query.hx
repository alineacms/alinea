package helder.store;

typedef QueryCreator<Params: {}, Row> = Params -> Cursor<Row>;

class Params {
  var current = 0;
  final names = new Map<String, Int>();
  public function new() {}

  @:keep function getVar(name: String) {
    return new Expression(Expr.Param(Named(name)));
  }
  
  #if php
  @:keep @:phpMagic function __get(name: String)
    return getVar(name);
  #end
}

class Query<V: {}, T> {
  public final cursor: Cursor<T>;
  public function new(create: QueryCreator<V, T>) {
    var params: Dynamic = new Params();
    #if js
    params = new js.lib.Proxy(params, {
      get: function (target, prop, receiver) {
        return js.Syntax.code("prop in target ? target[prop] : target.getVar(prop)");
      }
    });
    #end
    this.cursor = create(params);
  }
}

// Todo: type params in create so that they appear as Expressions
@:expose function query<Params: {}, Row>(create: QueryCreator<Params, Row>) {
  final query = new Query(create);
  return (params: Params) -> @:privateAccess query.cursor.parameterize(params);
}