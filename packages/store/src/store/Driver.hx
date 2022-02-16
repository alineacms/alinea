package helder.store;

@:expose
interface Driver {
  function transaction<T>(run: () -> T): T;
  function exec(sql: String): Void;
  function prepare(sql: String): PreparedStatement;
}

typedef DriverOptions = {
  ?readonly: Bool,
  ?fileMustExist: Bool
}

typedef PreparedStatement = {
  function all<T>(params: Array<Dynamic>): Array<T>;
  function run<T>(params: Array<Dynamic>): {changes: Int};
  function get<T>(params: Array<Dynamic>): T;
}