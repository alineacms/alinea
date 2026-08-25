import type {IndexKey, RecordId} from './Types.js'

export type QueryDependency = string

export function recordDependency(id: RecordId): QueryDependency {
  return `record:${id}`
}

export function indexDependency(key: IndexKey): QueryDependency {
  return `index:${key}`
}

export class DependencyTracker {
  #dependencies = new Set<QueryDependency>()

  add(dependency: QueryDependency): void {
    this.#dependencies.add(dependency)
  }

  snapshot(): ReadonlySet<QueryDependency> {
    return new Set(this.#dependencies)
  }
}

export function dependenciesIntersect(
  left: ReadonlySet<QueryDependency>,
  right: ReadonlySet<QueryDependency>
): boolean {
  const [smallest, largest] =
    left.size < right.size ? [left, right] : [right, left]
  for (const dependency of smallest) {
    if (largest.has(dependency)) return true
  }
  return false
}
