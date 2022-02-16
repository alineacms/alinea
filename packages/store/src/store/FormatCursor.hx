package helder.store;

import haxe.DynamicAccess;
import helder.store.sqlite.SqlEscape.escapeId;
import helder.store.Expression.toExpr;
import helder.store.From.JoinType;
import helder.store.Selection;
import helder.store.FormatExpr.FormatExprContext;
import helder.store.FormatExpr.formatExpr;
import helder.store.Expression.ExpressionImpl;
import helder.store.Cursor;
import tink.Anon.*;

typedef FormatCursorContext = {
  ?includeSelection: Bool,
  ?formatInline: Bool,
  formatSubject: (selection: Statement) -> Statement,
  formatAccess: (on: String, field: String) -> String,
  formatField: (path: Array<String>) -> String,
  formatUnwrapArray: (sql: String) -> String,
  escape: (value: Null<Any>) -> String,
  escapeId: (id: String) -> String
}

function formatSelection<T>(selection: Null<Selection<T>>, ctx: FormatExprContext): Statement {
  return switch selection {
    case null: '`data`';
    case {selected: Row(Column(from, column))}:
        '${ctx.escapeId(from.source())}.${escapeId(column)}';
    case {selected: Row(Table(name, columns, alias))}:
        final fields: DynamicAccess<Select<Dynamic>> = {}
        for (column in columns) 
          fields.set(column, Select.Expression(Expr.Field([
            if (alias == null) name else alias,
            column
          ])));
      formatSelection(new Selection(Fields(fields)), ctx);
    case {selected: Row(v)}:
      throw 'Cannot select $v';
    case {selected: Cursor(cursor)} if (cursor is CursorSingleRow):
      formatCursor(cursor, ctx).wrap(sql -> 
        '(select $sql)'
      );
    case {selected: Cursor(cursor)}:
      formatCursor(cursor, merge(ctx, {
        formatSubject: (subject) -> subject.wrap(sql -> '$sql as res')
      })).wrap(sql -> 
        '(select json_group_array(json(res)) from (select $sql))'
      );
    case {selected: Expression(e)}: formatExpr(e, ctx);
    case {selected: FieldsOf(Column(from, column), with)}:
      var target = 'json(${ctx.escapeId(from.source())}.${ctx.escapeId(column)})';
      if (with == null) target;
      else formatSelection(with, ctx).wrap(sql -> 'json_patch($target, $sql)');
    case {selected: FieldsOf(from = Table(_, _, _), with)}:
      var target = formatSelection(new Selection(Row(from)), ctx);
      if (with == null) target;
      else 
        ('json_patch(': Statement) + target + ', ' + formatSelection(with, ctx) + ')';
    case {selected: FieldsOf(v, _)}:
        throw 'Cannot select $v';
    case {selected: Fields(fields)}:
      var res: Statement = '';
      var i = 0;
      var length = fields.keys().length;
      @:nullSafety(Off) for (key => select in fields) {
        res += 
          formatSelection(select, ctx)
            .wrap(sql -> '${ctx.escape(key)}, $sql');
        if (i++ < length - 1) res += ',';
      }
      res.wrap(sql -> 'json_object($sql)');
  }
}

private function joinType(t: JoinType) {
  return switch t {
    case Left: 'left';
    case Inner: 'inner';
  }
}

function formatFrom(from: From, ctx: FormatExprContext): Statement {
  return switch from {
    case Table(name, _, null): ctx.escapeId(name);
    case Table(name, _, alias): '${ctx.escapeId(name)} as ${ctx.escapeId(alias)}';
    case Column(t, _): formatFrom(t, ctx);
    case Join(a, b, type, condition):
      final left = formatFrom(a, ctx);
      final right = formatFrom(b, ctx);
      final on = formatExpr(condition, ctx);
      left + joinType(type) + 'join' + right + 'on' + on;
  }
}

function formatOrderBy(orderBy: Null<Array<OrderBy>>, ctx: FormatExprContext): Statement {
  if (orderBy == null || orderBy.length == 0) return '';
  var orders = [];
  var params = [];
  for (o in orderBy) {
    final stmt = formatExpr(o.expr, ctx);
    orders.push('${stmt.sql} ${switch o.order {
      case Asc: 'asc';
      case Desc: 'desc';
    }}');
    params = params.concat(stmt.params);
  }
  return new Statement('order by ${orders.join(', ')}', params);
}

function formatWhere(where: Null<Expression<Bool>>, ctx: FormatExprContext): Statement {
  return
    if (where != null) formatExpr(where.expr, ctx)
    else '1';
}

function formatUpdate<Row>(update: Update<Row>, ctx: FormatExprContext): Statement {
  var source: Statement = '`data`';
  @:nullSafety(Off) for (field => expr in update) {
    final e = formatExpr(toExpr(expr), merge(ctx, {formatAsJsonValue: true}));
    source = 
      ('json_set(': Statement) +
        source +
        ', ' + ctx.escape('$.'+field) +
        ', ' + e +
      ')';
  }
  return ('set `data`=': Statement) + source;
}

private function formatCursor<Row>(
  cursor: Cursor<Row>, 
  ctx: FormatCursorContext
): Statement {
  final c = @:privateAccess cursor.cursor;
  final exprCtx: FormatExprContext = merge(ctx, {
    formatAsJsonValue: false,
    formatCursor: cursor -> formatCursor(cursor, ctx)
  });
  final limit = if (c.limit != null || c.offset != null)
    'limit ${if (c.limit == null) '0' else ctx.escape(c.limit)}' else '';
  final offset = if (c.offset != null)
    'offset ${ctx.escape(c.offset)}' else '';
  final selection: Statement = ctx.includeSelection == true
    ? ctx.formatSubject(formatSelection(c.select, exprCtx))
    : '';
  final from = formatFrom(c.from, exprCtx);
  final where = formatWhere(c.where, exprCtx);
  final order = formatOrderBy(c.orderBy, exprCtx);
  final sql = selection + 'from' + from + 'where' + where + order + limit + offset;
  return sql;
}

function formatCursorUpdate<Row>(cursor: Cursor<Row>, update: Update<Row>, ctx: FormatCursorContext) {
  final c = @:privateAccess cursor.cursor;
  final exprCtx: FormatExprContext = merge(ctx, {
    formatAsJsonValue: false,
    formatCursor: cursor -> formatCursor(cursor, ctx)
  });
  final from = formatFrom(c.from, exprCtx);
  final set = formatUpdate(update, exprCtx);
  final where = formatWhere(c.where, exprCtx);
  return ('update': Statement) + from + set + 'where' + where;
}

function formatCursorSelect<Row>(cursor: Cursor<Row>, ctx: FormatCursorContext) {
  return ('select': Statement) + formatCursor(cursor, merge(ctx, {includeSelection: true}));
}

function formatCursorDelete<Row>(cursor: Cursor<Row>, ctx: FormatCursorContext) {
  return ('delete': Statement) + formatCursor(cursor, merge(ctx, {includeSelection: false}));
}