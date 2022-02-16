import { Driver } from '../../Driver'

type Database = ReturnType<typeof import('better-sqlite3')>

export class BetterSqlite3Driver implements Driver {
  constructor(public db: Database) {}
  public function new(file: String = ':memory:', ?options: DriverOptions)
    db = BSQL3.call(file, (cast options: better_sqlite3.Options));
  public function exec(sql: String)
    db.exec(sql);
  public function prepare(sql: String): PreparedStatement
    return new Statement(db.prepare(sql));
  public function transaction<T>(run: () -> T): T
    return db.transaction(run).call();
  public function export()
    return (db: Dynamic).serialize();
}

typedef BSQL3Statement = {
  function pluck(bool: Bool): BSQL3Statement;
  function all<T>(...params: Dynamic): Array<T>;
  function run<T>(...params: Dynamic): {changes: Int};
  function get<T>(...params: Dynamic): T;
}

private class Statement {
  final stmt: BSQL3Statement;
  public function new(stmt: BSQL3Statement)
    this.stmt = stmt;
  public function all<T>(params: Array<Dynamic>): Array<T>
    return stmt.pluck(true).all(...params);
  public function run<T>(params: Array<Dynamic>): {changes: Int}
  return stmt.run(...params);
  public function get<T>(params: Array<Dynamic>): T
    return stmt.pluck(true).get(...params);
}
