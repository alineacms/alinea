type Key = unknown
type Branch = Map<Key, Branch>

export class DeepMap<Keys extends ReadonlyArray<unknown>, Value> {
  #tree: Branch = new Map()
  #values: Map<Branch, Value> = new Map()

  constructor(entries?: ReadonlyArray<readonly [Keys, Value]> | null) {
    if (entries) for (const entry of entries) this.set(...entry)
  }

  get size(): number {
    return this.#values.size
  }

  get(keys: Keys): Value | undefined {
    const branch = this.#getBranch(keys)
    if (!branch) return
    return this.#values.get(branch)
  }

  #getBranch(keys: Keys): Branch | undefined {
    let branch: Branch = this.#tree
    for (const key of keys) {
      if (!branch.has(key)) return
      branch = branch.get(key)!
    }
    return branch
  }

  set(keys: Keys, value: Value): this {
    let branch: Branch = this.#tree
    for (const key of keys) {
      if (branch.has(key)) branch = branch.get(key)!
      else branch.set(key, (branch = new Map()))
    }
    this.#values.set(branch, value)
    return this
  }

  has(keys: Keys): boolean {
    const branch = this.#getBranch(keys)
    if (!branch) return false
    return this.#values.has(branch)
  }

  delete(keys: Keys): boolean {
    const branch = this.#getBranch(keys)
    if (!branch) return false
    return this.#values.delete(branch)
  }

  clear(): void {
    this.#clearBranch(this.#tree)
  }

  #clearBranch(branch: Branch) {
    if (this.#values.has(branch)) this.#values.delete(branch)
    for (const map of branch.values()) this.#clearBranch(map)
    return branch.clear()
  }

  *keys(): IterableIterator<Keys> {
    yield* this.#keysOfBranch(this.#tree)
  }

  *#keysOfBranch(
    branch: Branch,
    keys: ReadonlyArray<Keys[number]> = []
  ): IterableIterator<Keys> {
    for (const [key, map] of branch) {
      const current = keys.concat(key)
      if (this.#values.has(map)) yield current as unknown as Keys
      yield* this.#keysOfBranch(map, current)
    }
  }

  *values(): IterableIterator<Value> {
    yield* this.#values.values()
  }

  *entries(): IterableIterator<[Keys, Value]> {
    for (const keys of this.keys()) yield [keys, this.get(keys)!]
  }

  [Symbol.iterator](): IterableIterator<[Keys, Value]> {
    return this.entries()
  }
}
