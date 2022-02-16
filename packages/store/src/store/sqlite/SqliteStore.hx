package helder.store.sqlite;

import helder.store.FormatCursor.formatFrom;
import haxe.DynamicAccess;
import helder.store.Collection.GenericCollection;
import helder.store.Expression.toExpr;
import helder.store.FormatExpr.formatExpr;
import helder.store.FormatCursor.formatCursorUpdate;
import helder.store.FormatCursor.formatCursorDelete;
import helder.store.FormatCursor.formatCursorSelect;
import helder.store.sqlite.SqlEscape.escape;
import helder.store.sqlite.SqlEscape.escapeId;
import helder.store.Driver;
import haxe.Json;
import helder.store.FormatCursor.FormatCursorContext;
import helder.Store;
import tink.Anon.merge;

using Lambda;

function formatField(path: Array<String>, shallow = false) {
  return switch path {
    case []: throw 'assert';
    case [from]: escapeId(from);
    default: 
      final target = (shallow ? [path[1]] : [path[0], path[1]]).map(escapeId).join('.');
      if (path.length == 2) return target;
      final rest = "$." + path.slice(2).join('.');
      'json_extract($target, ${escape(rest)})';
  }
}

final context: FormatCursorContext = {
  formatInline: false,
  formatSubject: (selection) -> selection,
  formatAccess: (on, field) -> 'json_extract(${on}, \'$.${field}\')',
  formatField: path -> formatField(path),
  formatUnwrapArray: sql -> '(select value from json_each($sql))',
  escape: escape,
  escapeId: escapeId
}

typedef CreateId = () -> String;

class SqliteStore implements Store {
  final db: Driver;
  final createId: CreateId;
  final statements = new Map<Cursor<Dynamic>, {
    stmt: Statement,
    prepared: PreparedStatement
  }>();

  public function new(db: Driver, createId: CreateId) {
    this.db = db;
    this.createId = createId;
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA optimize');
  }

  public function all<Row>(cursor: Cursor<Row>, ?options: QueryOptions): Array<Row> {
    var stmt: Statement, prepared, params = null;
    if (cursor.cursor.parameterized != null) {
      final parameterized = cursor.cursor.parameterized;
      if (!statements.exists(parameterized.cursor)) {
        final stmt = formatCursorSelect(cursor, context);
        statements.set(parameterized.cursor, {
          stmt: stmt,
          prepared: prepare(cursor.cursor.collections, stmt.sql, options)
        });
      }
      final cache = statements.get(parameterized.cursor);
      if (cache == null) throw 'assert';
      stmt = cache.stmt;
      prepared = cache.prepared;
      params = parameterized.params;
    } else {
      stmt = formatCursorSelect(cursor, context);
      prepared = prepare(cursor.cursor.collections, stmt.sql, options);
    }
    return prepared
      .all(stmt.getParams(params))
      .map((col: String) -> haxe.Json.parse(col));
  }

  public function first<Row>(
    cursor: Cursor<Row>, 
    ?options: QueryOptions
  ): Null<Row> {
    return all(cursor.take(1), options)[0];
  }

  public function delete<Row>(
    cursor: Cursor<Row>,
    ?options: QueryOptions
  ): {changes: Int} {
    final stmt = formatCursorDelete(cursor, context);
    return prepare(
      cursor.cursor.collections, 
      stmt.sql, 
      options
    ).run(stmt.getParams(
      cursor.cursor.parameterized != null ? cursor.cursor.parameterized.params : null
    ));
  }

  public function count<Row>(cursor: Cursor<Row>, ?options: QueryOptions): Int {
    final stmt = formatCursorSelect(cursor, context);
    return prepare(
      cursor.cursor.collections, 
      'select count() from (${stmt.sql})',
      options
    )
      .get(stmt.getParams(
        cursor.cursor.parameterized != null ? cursor.cursor.parameterized.params : null
      ));
  }
  
  public function insertAll<Row:Document, In:{?id: String} & Row>(
    collection: Collection<Row>, 
    objects: Array<IdLess<In>>, 
    ?options: QueryOptions
  ): Array<Row> {
    return db.transaction(() -> {
      return objects.map(document -> {
        final res: Row = cast document;
        final fields: DynamicAccess<Dynamic> = cast res;
        if (res.id == null) res.id = createId();
        switch collection.cursor.from {
          case Column(Table(name, _, _), _):
            prepare([collection], 'insert into ${escapeId(name)} values (?)', options)
              .run([Json.stringify(res)]);
          case Table(name, columns, _):
            prepare(
              [collection], 
              'insert into ${escapeId(name)} values (${columns.map(_ -> '?').join(', ')})', 
              options
            ).run(
              columns.map(col -> cast fields[col])
            );
          default:
            throw 'assert';
        }
        return res;
      });
    });
  }

  public function insert<Row:Document, In:{?id: String} & Row>(
    collection: Collection<Row>, 
    object: IdLess<In>, 
    ?options: QueryOptions
  ): Row {
    return insertAll(collection, [object], options)[0];
  }

  public function update<Row>(cursor: Cursor<Row>, update: Update<Row>, ?options: QueryOptions): {changes: Int} {
    return db.transaction(() -> {
      final stmt = formatCursorUpdate(cursor, update, context);
      return prepare(cursor.cursor.collections, stmt.sql, options)
        .run(stmt.getParams(
          cursor.cursor.parameterized != null ? cursor.cursor.parameterized.params : null
        ));
    });
  }

  public function createIndex<Row:Document>(
    collection: Collection<Row>,
    name: String,
    on: Array<Expression<Dynamic>>
  ) {
    final tableName = switch collection.cursor.from {
      case Table(name, _) | Column(Table(name, _), _): name;
      default: throw 'assert';
    }
    final table = escapeId(tableName);
    final exprs = [];
    for (expr in on) {
      final stmt = formatExpr(toExpr(expr), merge(context, {
        formatInline: true,
        formatAsJsonValue: false,
        formatCursor: cursor -> throw 'assert',
        formatField: path -> formatField(path, true)
      }));
      if (stmt.params.length > 0) {
        throw 'Parameters in index expressions are currently unsupported';
      }
      exprs.push(stmt.sql);
    }
    final sql = 'create index if not exists ${escape(
      [tableName, name].join('.')
    )} on ${table}(${exprs.join(', ')});';
    return createOnError([collection], () -> db.exec(sql));
  }

  public function transaction<T>(run: () -> T): T {
    return db.transaction(run);
  }

  function prepare(
    collections: Iterable<GenericCollection>, 
    query: String, 
    ?options: QueryOptions
  ): PreparedStatement {
    if (options != null && options.debug)
      trace(query);
    return createOnError(collections, () -> db.prepare(query));
  }

  public function createFts5<Row: {}>(
    collection: Collection<Row>,
    name: String,
    fields: (collection: Collection<Row>) -> DynamicAccess<Expression<String>>
  ): Bool {
    final created = this.createFts5Table(collection, name, fields);
    if (created) this.createFts5Triggers(collection, name, fields);
    return created;
  }

  public function createFts5Table<Row: {}>(
    collection: Collection<Row>,
    name: String,
    fields: (collection: Collection<Row>) -> DynamicAccess<Expression<String>>
  ): Bool {
    final exists = this.db
      .prepare('select distinct tbl_name from sqlite_master where tbl_name = ?')
      .get([name]);
    if (exists) return false;
    final newFields = fields(collection.as('new'));
    final keys = newFields.keys().map(key -> escapeId(key));
    final instruction = 'create virtual table ${escapeId(
      name
    )} using fts5(id unindexed, ${keys.join(', ')})';
    this.db.exec(instruction);
    return true;
  }

  public function createFts5Triggers<Row: {}>(
    collection: Collection<Row>,
    name: String,
    fields: (collection: Collection<Row>) -> DynamicAccess<Expression<String>>
  ) {
    final ctx = merge(context, {
      formatInline: true,
      formatAsJsonValue: false,
      formatCursor: cursor -> throw 'assert',
      formatField: path -> formatField(path, true)
    });
    final table = formatFrom(collection.cursor.from, ctx);
    final idx = escapeId(name);
    final newFields = fields(collection.as('new'));
    final keys = newFields.keys().map(key -> escapeId(key));
    final originValues = @:nullSafety(Off) [
      for (expr in fields(collection))
        formatExpr(expr.expr, ctx)
    ].join(', ');
    final newValues = @:nullSafety(Off) [
      for (expr in newFields)
        formatExpr(expr.expr, ctx)
    ];
    final setters = keys.mapi((i, key) -> {
      return '${key}=${newValues[i]}';
    });
    final id = "'$.id'";
    final instruction = '
			create trigger ${escapeId('${name}_ai')} after insert on ${table} begin
				insert into ${idx}(id, ${keys.join(", ")}) 
        values (json_extract(new.data, $id), ${newValues.join(", ")});
			end;
			create trigger ${escapeId('${name}_ad')} after delete on ${table} begin
				delete from ${idx} where id=json_extract(old.data, $id);
			end;
			create trigger ${escapeId('${name}_au')} after update on ${table} begin
        update ${idx} set ${setters} where id=json_extract(new.data, $id);
			end;
			insert into ${escapeId(name)}(id, ${keys.join(", ")})
				select ${formatExpr(collection.id.expr, ctx)}, ${originValues}
				from ${table};
		';
    this.db.exec(instruction);
  }

  function createOnError<T>(
    collections: Iterable<GenericCollection>, 
    run: () -> T
  ): T {
    function next(?retry: String): T {
      try return run()
      catch (e) {
        final NO_TABLE = 'no such table: ';
        final index = e.message.indexOf(NO_TABLE);
        if (index > -1) {
          final table = e.message.substr(index + NO_TABLE.length).split('.').pop();
          if (retry != table && table != null) {
            createTable(collections, table);
            return next(table);
          }
        }
        throw e;
      }
    }
    return next();
  }

  function createTable(collections: Iterable<GenericCollection>, name: String) {
    // Find out which collection we're trying to create
    final collection = collections.find(coll -> {
      return Collection.getName(coll) == name;
    });
    if (collection == null) throw 'Cannot create "$name"';
    db.exec('create table if not exists ${escapeId(name)}(data json);');
    createIndex(collection, 'id', [collection.id]);
  }
}
