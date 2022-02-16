package helder.store.sqlite;

interface SqliteConnection {
  function transaction<T>(run: () -> T): T;
  function exec(sql: String): Void;
  function prepare(sql: String): SqliteStatement;
  function export(): haxe.io.Bytes;
}

typedef SqliteConnectionOptions = {
  ?readonly: Bool,
  ?fileMustExist: Bool
}

typedef SqliteStatement = {
  function all<T>(params: Array<Dynamic>): Array<T>;
  function run<T>(params: Array<Dynamic>): {changes: Int};
  function get<T>(params: Array<Dynamic>): T;
}