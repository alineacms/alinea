package helder.store.sqlite.drivers;

import helder.store.Driver;
import php.db.SQLite3 as SQL3;
import php.db.SQLite3Stmt as SQL3Statement;

class Sqlite3 implements Driver {
  final db: SQL3;
  private static var transactionId = 0;
  // TODO apply flags of options
  public function new(file: String = ':memory:', ?options: DriverOptions) {
    db = new SQL3(file);
    db.enableExceptions(true);
  }
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
}

private class Statement {
  final db: SQL3;
  final stmt: SQL3Statement;
  public function new(db, stmt: SQL3Statement) {
    this.db = db;
    this.stmt = stmt;
  }
  public function all<T>(params: Array<Dynamic>): Array<T> {
    for (i in 0 ... params.length) stmt.bindValue(i + 1, params[i]);
    final res = [];
    final resultSet = stmt.execute();
    while (true) {
      final row = resultSet.fetchArray(2);
      if (row == false) break;
      res.push((row: Dynamic)[0]);
    }
    resultSet.finalize();
    return cast res;
  }
  public function run<T>(params: Array<Dynamic>): {changes: Int} {
    for (i in 0 ... params.length) stmt.bindValue(i + 1, params[i]);
    stmt.execute();
    return {changes: db.changes()}
  }
  public function get<T>(params: Array<Dynamic>): T {
    return all(params)[0];
  }
}