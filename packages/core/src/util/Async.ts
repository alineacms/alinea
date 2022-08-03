/** Accumulate all entries of an AsyncGenerator into an array */
export async function accumulate<T>(gen: AsyncGenerator<T>): Promise<Array<T>> {
  const acc = []
  for await (const item of gen) acc.push(item)
  return acc
}

export async function* toGenerator<T>(
  iterable: Iterable<T>
): AsyncGenerator<T> {
  for (const item of iterable) yield item
}
