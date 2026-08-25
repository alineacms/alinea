export class RoleTable {
  readonly roles: ReadonlyArray<string>
  #indices = new Map<string, number>()

  constructor(roles: Iterable<string>) {
    const unique = Array.from(new Set(roles))
    for (let index = 0; index < unique.length; index++) {
      this.#indices.set(unique[index], index)
    }
    this.roles = unique
  }

  get byteLength(): number {
    return Math.ceil(this.roles.length / 8)
  }

  mask(roles: Iterable<string>): RoleMask {
    const bytes = new Uint8Array(this.byteLength)
    for (const role of roles) {
      const index = this.#indices.get(role)
      if (index === undefined) continue
      bytes[index >>> 3] |= 1 << (index & 7)
    }
    return new RoleMask(bytes)
  }
}

export class RoleMask {
  #bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes.slice()
  }

  intersects(that: RoleMask): boolean {
    const length = Math.min(this.#bytes.length, that.#bytes.length)
    for (let index = 0; index < length; index++) {
      if ((this.#bytes[index] & that.#bytes[index]) !== 0) return true
    }
    return false
  }

  union(that: RoleMask): RoleMask {
    const bytes = new Uint8Array(
      Math.max(this.#bytes.length, that.#bytes.length)
    )
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = (this.#bytes[index] ?? 0) | (that.#bytes[index] ?? 0)
    }
    return new RoleMask(bytes)
  }

  equals(that: RoleMask): boolean {
    const length = Math.max(this.#bytes.length, that.#bytes.length)
    for (let index = 0; index < length; index++) {
      if ((this.#bytes[index] ?? 0) !== (that.#bytes[index] ?? 0)) return false
    }
    return true
  }

  toBytes(): Uint8Array {
    return this.#bytes.slice()
  }
}
