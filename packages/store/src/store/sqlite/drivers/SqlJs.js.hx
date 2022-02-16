package helder.store.sqlite.drivers;

import helder.store.Driver;
import sql_js.Database;
import sql_js.Statement as SqlJsStatement;
import SqlJs as SqlJsLib;

@:native('__sqlJs.Database')
@:genes.type("typeof import('sql.js').Database")
extern class Database extends sql_js.Database {}

class SqlJs implements Driver {
  final db: Database;
  private static var transactionId = 0;
  public function new(db: Database)
    this.db = db;
  public function exec(sql: String)
    db.exec(sql);
  public function prepare(sql: String): PreparedStatement
    return new Statement(db, db.prepare(sql));
  public function transaction<T>(run: () -> T): T {
    final id = 't${transactionId++}';
    exec('savepoint $id');
    try {
      final res = run();
      exec('release $id');
      return res;
    } catch(e) {
      exec('rollback to $id');
      throw e;
    }
  }
  public static function init(?options) {
    return SqlJsLib.default_.call_(options).then(sql-> {
      js.Lib.global.__sqlJs = sql;
    });
  }
}

private class Statement {
  final db: Database;
  final stmt: SqlJsStatement;
  public function new(db: Database, stmt: SqlJsStatement) {
    this.db = db;
    this.stmt = stmt;
  }
  public function all<T>(params: Array<Dynamic>): Array<T> {
    stmt.bind(params);
    final res = [];
    while (stmt.step())
      res.push(stmt.get()[0]);
    return cast res;
  }
  public function run<T>(params: Array<Dynamic>): {changes: Int} {
    stmt.run(params);
    return {changes: (cast db.getRowsModified(): Int)}
  }
  public function get<T>(params: Array<Dynamic>): T {
    return all(params)[0];
  }
}
