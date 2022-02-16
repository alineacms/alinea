package helder.store;

import helder.store.Expression.Expr;

enum JoinType {
  Left;
  Inner;
}

@:expose
@:using(helder.store.From.FromTools) 
enum From {
  Table(name: String, columns: Array<String>, ?alias: String);
  Column(of: From, column: String);
  Join(left: From, right: From, type: JoinType, on: Expr);
}

class FromTools {
  public static function source(from: From): String {
    return switch from {
      case Column(Table(name, _, alias), _) | Table(name, _, alias):
        if (alias != null) alias else name;
      default: throw 'Cannot source join';
    }
  }
}