export class DeepMap<K, V> {
  #root = new Map()
  #leaves = new Map()

  constructor(entries?: ReadonlyArray<readonly [ReadonlyArray<K>, V]> | null) {
    if (entries) for (const entry of entries) this.set(...entry)
  }

  get size(): number {
    return this.#leaves.size
  }

  set(keys: ReadonlyArray<K>, value: V): this {
    let branch: Map<any, any> = this.#root
    for (const key of keys) {
      if (branch.has(key)) branch = branch.get(key)
      else branch.set(key, (branch = new Map()))
    }
    this.#leaves.set(branch, value)
    return this
  }

  #clearBranch(branch: Map<any, any>) {
    if (this.#leaves.has(branch)) this.#leaves.delete(branch)
    for (let map of branch.values()) this.#clearBranch(map)
    return branch.clear()
  }

  clear(): void {
    this.#clearBranch(this.#root)
  }

  delete(keys: ReadonlyArray<K>): boolean {
    let branch = this.#root
    for (const key of keys) {
      if (branch.has(key)) {
        branch = branch.get(key)
      } else {
        return false
      }
    }
    return this.#leaves.delete(branch)
  }

  has(keys: ReadonlyArray<K>): boolean {
    let branch = this.#root
    for (const key of keys) {
      if (branch.has(key)) {
        branch = branch.get(key)
      } else {
        return false
      }
    }
    return this.#leaves.has(branch)
  }

  get(keys: ReadonlyArray<K>): V | undefined {
    let branch = this.#root
    for (const key of keys) branch = branch.get(key)
    return this.#leaves.get(branch)
  }

  *values(): IterableIterator<V> {
    for (const value of this.#leaves.values()) yield value
  }

  *#keysOfBranch(
    branch: Map<any, any>,
    keys: Array<K> = []
  ): IterableIterator<ReadonlyArray<K>> {
    for (const [key, map] of branch) {
      const current = keys.concat(key)
      if (this.#leaves.has(map)) yield current
      yield* this.#keysOfBranch(map, current)
    }
  }

  *keys(): IterableIterator<ReadonlyArray<K>> {
    yield* this.#keysOfBranch(this.#root)
  }

  *entries(): IterableIterator<[ReadonlyArray<K>, V]> {
    for (const keys of this.keys()) yield [keys, this.get(keys)!]
  }

  [Symbol.iterator](): IterableIterator<[ReadonlyArray<K>, V]> {
    return this.entries()
  }
}
