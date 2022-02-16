package helder.store;

import helder.store.From;
import haxe.DynamicAccess;
import helder.store.Collection.CollectionImpl;
import helder.store.Expression;

typedef SelectionWith<T> = helder.store.util.TSTypes.TSWith<T>;

enum Select<T> {
  Expression<T>(e: Expr): Select<T>;
  Cursor<T>(c: Cursor<T>): Select<T>;
  FieldsOf<T>(source: From, ?add: Select<Dynamic>): Select<T>;
  Fields<T>(fields: DynamicAccess<Select<Dynamic>>): Select<T>;
  Row<T>(source: From): Select<T>;
}

@:using(helder.store.Selection)
class SelectionImpl<T> {
  public final selected: Select<T>;
  
  public function new(selected: Select<T>) {
    this.selected = selected;
  }
  
  #if (genes && js) 
  @:native('with') 
  @:genes.type('SelectionWith<T>')
  public final __with = js.Syntax.code('this.__with');
  @:native('__with') 
  #end
  @:genes.internal public function _with<X>(that: Dynamic): Dynamic {
    return new SelectionImpl(switch this.selected {
      case FieldsOf(name, null): FieldsOf(name, create(that));
      default: throw 'assert';
    });
  }

  // Create the selection at runtime - we could do this at compile time too
  // but then the lib is only useable from haxe
  public static function create<T>(input: Dynamic): Select<T> {
    if (input is SelectionImpl) return input.selected;
    if (input is ExpressionImpl) return Select.Expression(input.expr);
    if (input is CollectionImpl) return Select.Fields(input.fields);
    if (input is Cursor) return Select.Cursor(input);
    if (input is Select) return input;
    final obj: DynamicAccess<Dynamic> = input;
    final res: DynamicAccess<Select<Dynamic>> = {}
    @:nullSafety(Off) for (key => value in obj)
      res[key] = create(value);
    return Select.Fields(res);
  }

  public function toJSON() {
    return selected;
  }
}

@:forward
abstract Selection<T>(SelectionImpl<T>) from SelectionImpl<T> {
  public function new(selection: Select<T>) 
    this = new SelectionImpl(selection);

  @:from
  public static macro function ofAny(expr: haxe.macro.Expr) {
    #if macro
    return helder.store.macro.Selection.create(expr);
    #end
  }

  @:noUsing
  public static function fieldsOf<T:{}>(collection: CollectionImpl<T>): Selection<T> {
    return new Selection(FieldsOf(collection.cursor.from));
  }
  
  // Extern generic inline is useless, but forces the compiler to close
  // what is otherwise a constrained monomorph.
  @:extern @:generic inline
  public static function with<A: {}, B: {}, C: A & B>(a: Selection<A>, b:Selection<B>): Selection<C> {
    return a._with(cast b);
  }
}