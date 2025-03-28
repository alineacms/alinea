export class DeepMap<Keys extends ReadonlyArray<any>, V> {
  #root = new Map()
  #leaves = new Map()

  constructor(entries?: ReadonlyArray<readonly [Keys, V]> | null) {
    if (entries) for (const entry of entries) this.set(...entry)
  }

  get size(): number {
    return this.#leaves.size
  }

  set(keys: Keys, value: V): this {
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
    for (const map of branch.values()) this.#clearBranch(map)
    return branch.clear()
  }

  clear(): void {
    this.#clearBranch(this.#root)
  }

  delete(keys: Keys): boolean {
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

  has(keys: Keys): boolean {
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

  get(keys: Keys): V | undefined {
    let branch = this.#root
    for (const key of keys) branch = branch.get(key)
    return this.#leaves.get(branch)
  }

  *values(): IterableIterator<V> {
    for (const value of this.#leaves.values()) yield value
  }

  *#keysOfBranch(
    branch: Map<any, any>,
    keys: Array<Keys[number]> = []
  ): IterableIterator<Keys> {
    for (const [key, map] of branch) {
      const current = keys.concat(key)
      if (this.#leaves.has(map)) yield current as any
      yield* this.#keysOfBranch(map, current)
    }
  }

  *keys(): IterableIterator<Keys> {
    yield* this.#keysOfBranch(this.#root)
  }

  *entries(): IterableIterator<[Keys, V]> {
    for (const keys of this.keys()) yield [keys, this.get(keys)!]
  }

  [Symbol.iterator](): IterableIterator<[Keys, V]> {
    return this.entries()
  }
}
