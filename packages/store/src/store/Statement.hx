package helder.store;

import haxe.DynamicAccess;

class StatementImpl {
  public final sql: String;
  public final params: Array<Parameter>;

  public function new(sql: String, params: Array<Parameter>) {
    this.sql = sql;
    this.params = params;
  }

  public function wrap(adder: (sql: String) -> Statement) {
    final a = this;
    final b = adder(sql);
    return new Statement(
      b.sql, a.params.concat(b.params)
    );
  }

  public function getParams(?input: Null<DynamicAccess<Any>>): Array<Dynamic> {
    return [
      for (param in params)
        switch param {
          case Value(v): v;
          case Named(name):
            if (input == null || !input.exists(name)) throw 'Missing param "$name"';
            input[name];
        }
    ];
  }
}

@:forward
abstract Statement(StatementImpl) {
  public function new(sql: String, params: Array<Parameter>)
    this = new StatementImpl(sql, params);
  @:from public static function fromString(str: String) {
    return new Statement(str, []);
  }
  @:op(a+b) public function add(that: Statement) {
    return new Statement(
      this.sql + ' ' + that.sql, 
      this.params.concat(that.params)
    );
  }
}