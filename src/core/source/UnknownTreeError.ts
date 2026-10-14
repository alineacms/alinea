/** A remote cannot tell what changed since a tree it does not know. */
export class UnknownTreeError extends Error {
  constructor(public sha: string) {
    super(`Unknown tree: ${sha}`)
  }
}
