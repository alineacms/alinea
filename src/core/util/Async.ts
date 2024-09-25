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

export function genEffect<T, TReturn>(
  gen: AsyncIterable<T, TReturn>,
  effect: (result: IteratorResult<T, TReturn>) => void
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const iter = gen[Symbol.asyncIterator]()
      const stack: Array<Promise<IteratorResult<T, TReturn>>> = []
      const dispense = () => {
        stack.push(
          iter.next().then(res => {
            effect(res)
            if (!res.done) dispense()
            return res
          })
        )
      }
      dispense()
      return {
        next() {
          return stack.shift()!
        }
      }
    }
  }
}
