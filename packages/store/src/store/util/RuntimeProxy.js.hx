package helder.store.util;

@:forward
abstract RuntimeProxy<T>(T) to T {
  inline public function new(subject: T, get: (property: String) -> Dynamic) {
    this = cast new js.lib.Proxy(cast subject, {
      get: function(target: Dynamic, property: Dynamic, receiver) {
        final hasProperty = js.Syntax.code('property in target');
        return if (hasProperty) target[property] else get(property);
      }
    });
  }
}