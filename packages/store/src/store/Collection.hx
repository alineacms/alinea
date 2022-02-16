package helder.store;

import haxe.DynamicAccess;
import helder.store.Expression;
import helder.store.From;
import helder.store.Selection;

typedef CollectionWith<T> = helder.store.util.TSTypes.TSWith<T>;

#if (js && genes)
@:genes.type('(U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never')
typedef UnionToIntersection<U> = Dynamic;

@:genes.type('Row extends object
  ? {[K in keyof Row]-?: Expression<Row[K]> & FieldsOf<Row[K]>}
  : unknown
')
typedef FieldsOf<Row> = Dynamic;

@:native('Collection')
@:genes.type('CollectionImpl<Row> & UnionToIntersection<FieldsOf<Row>>')
typedef TSCollection<Row> = Dynamic;

@:expose
@:native('Collection')
@:genes.type('{new<Row extends {}>(name: string, options?: {}): Collection<Row>}')
final ESCollection = js.Syntax.code('
  class Collection extends CollectionImpl {
    constructor(name, options) {
      super(name, options);
      return new Proxy(this, {
        get: (target, property) => {
          if (property in target) return target[property];
          return target.get(property);
        }
      });
    }
  }
');
#end

@:forward
abstract Collection<T:{}>(CollectionImpl<T>) to CollectionImpl<T> from CollectionImpl<T> {
  inline public function new(name: String, ?options: CollectionOptions) {
    final inst = new CollectionImpl<T>(name, options);
    this = 
      #if js new helder.store.util.RuntimeProxy(inst, inst.get)
      #else inst #end;
  }

  @:op(a.b)
  macro public function getProp(expr: haxe.macro.Expr, property: String) {
    #if macro
    return helder.store.macro.Expression.getProp(expr, property);
    #end
  }

  public static function getName(collection: CollectionImpl<Dynamic>): String {
    return switch collection.cursor.from {
      case Column(Table(name, _), _) | Table(name, _): name;
      default: throw 'unexpected';
    }
  }

  public static function getAlias(collection: CollectionImpl<Dynamic>): String {
    return collection.cursor.from.source();
  }

  // Extern generic inline is useless, but forces the compiler to close
  // what is otherwise a constrained monomorph.
  @:extern @:generic inline
  public function with<B: {}, C: T & B>(b:Selection<B>): Selection<C> {
    return cast this._with(cast b);
  }
}

typedef CollectionOptions = {
  ?flat: Bool,
  ?columns: Array<String>,
  ?where: Expression<Bool>,
  ?idColumn: String,
  ?alias: String
}

typedef GenericCollection = CollectionImpl<Dynamic>;

class CollectionImpl<Row:{}> extends Cursor<Row> {
  private final idColumn: String;
  public var id(get, never): Expression<String>;
  public var fields(get, never): Selection<Row>;

  public function new(name: String, ?options: CollectionOptions) {
    final collections = new Map();
    final isFlat = options != null && options.flat;
    final cols = options != null && options.columns != null ? options.columns : [];
    final from = isFlat
      ? Table(name, cols, options != null ? options.alias : null)
      : Column(
          Table(
            name, 
            ['data'],
            if (options == null) null else options.alias
          ),
          'data'
        );
    super({
      select: new Selection(Row(from)),
      from: from,
      where: if (options == null) null else options.where,
      collections: collections
    });
    idColumn = 
      if (options == null || options.idColumn == null) 'id' 
      else options.idColumn;
    collections.set(name, this);
  }

  public function get<T>(name: String): Expression<T> {
    final path: Array<String> = switch cursor.from {
      case Column(From.Table(name, _, alias), column): 
        [if (alias != null) alias else name, column];
      case Table(name, _, alias): [if (alias != null) alias else name];
      default: throw 'Cannot field access';
    }
    return new Expression(Field(path.concat([name])));
    // todo: return new Proxy(expr, exprProxy);
  }

  #if php
  @:keep @:phpMagic function __get(name:String) {
    return php.Global.property_exists(this, name)
      ? php.Syntax.field(this, name)
      : get(name);
  }
  #end

  function get_id(): Expression<String> {
    return cast get(idColumn);
  }
  
  @:native('with')
  @:genes.type('CollectionWith<Row>')
  public function _with<S>(that: S) {
    return this.fields._with(that);
  }

  @:genes.returnType('Collection<Row>')
  public function as(name: String): Collection<Row> {
    return new Collection<Row>(
      switch cursor.from {
        case Table(name, _) | Column(Table(name, _), _): name;
        default: throw 'assert';
      }, 
      {alias: name}
    );
  }

  function get_fields(): Selection<Row> {
    return Selection.fieldsOf(this);
  }
}