export function dispense<Key = string, Value = unknown>(
  fn: (key: Key) => Value
): (key: Key) => Value {
  const values = new Map<Key, Value>()
  return function dispenseValue(key: Key) {
    if (!values.has(key)) values.set(key, fn(key))
    return values.get(key)!
  }
}
