import {hashTree, serializeTreeEntries} from '#/core/source/GitUtils.js'
import {ReadonlyTree, type BaseEntry, type Entry} from '#/core/source/Tree.js'
import {compareStrings} from '#/core/source/Utils.js'
import {and, type Database, eq, primaryKey, table} from 'rado'
import * as column from 'rado/universal/columns'

const TreeTable = table('alinea_source_tree', {
  sha: column.varchar(undefined, {length: 40}).primaryKey()
})

const ChildTable = table(
  'alinea_source_tree_child',
  {
    treeSha: column.varchar(undefined, {length: 40}).notNull(),
    name: column.varchar(undefined, {length: 255}).notNull(),
    sha: column.varchar(undefined, {length: 40}).notNull(),
    mode: column.varchar(undefined, {length: 6}).notNull(),
    directory: column.boolean().notNull()
  },
  child => ({primary: primaryKey(child.treeSha, child.name)})
)

export interface TreeChild extends BaseEntry {
  name: string
  directory: boolean
}

export interface TreeChange {
  path: string
  before?: BaseEntry
  after?: BaseEntry
}

export interface TreeDifference {
  fromSha: string
  toSha: string
  changes: Array<TreeChange>
}

/** Immutable source metadata only. No query needs authored entry payloads. */
export class SqlTree {
  readonly sha: string
  #db: Database

  constructor(db: Database, sha: string) {
    this.#db = db
    this.sha = sha
  }

  static async createSchema(db: Database): Promise<void> {
    await db.create(TreeTable, ChildTable)
  }

  /** The caller serializes writers; the transaction also accepts an outer tx. */
  static async store(db: Database, tree: ReadonlyTree): Promise<SqlTree> {
    const pending = new Map<string, Array<TreeChild>>()
    async function prepare(node: ReadonlyTree): Promise<void> {
      if (pending.has(node.sha)) return
      const exists = await db
        .select(TreeTable.sha)
        .from(TreeTable)
        .where(eq(TreeTable.sha, node.sha))
        .get()
      if (exists) return
      const entries = node.entries
      if ((await hashTree(serializeTreeEntries(entries))) !== node.sha)
        throw new Error(`Invalid source tree hash: ${node.sha}`)
      for (const entry of entries) {
        if (entry.entries)
          await prepare(
            new ReadonlyTree({sha: entry.sha, entries: entry.entries})
          )
      }
      pending.set(
        node.sha,
        entries.map(entry => ({
          name: entry.name,
          sha: entry.sha,
          mode: entry.mode,
          directory: entry.entries !== undefined
        }))
      )
    }
    await prepare(tree)
    if (pending.size > 0) {
      await db.transaction(
        async tx => {
          for (const [sha, children] of pending) {
            await tx.insert(TreeTable).values({sha})
            // Keep parameter counts bounded on drivers with small limits.
            for (let offset = 0; offset < children.length; offset += 100) {
              await tx.insert(ChildTable).values(
                children.slice(offset, offset + 100).map(child => ({
                  treeSha: sha,
                  ...child
                }))
              )
            }
          }
        },
        {async: true}
      )
    }
    return new SqlTree(db, tree.sha)
  }

  async children(): Promise<Array<TreeChild>> {
    const exists = await this.#db
      .select(TreeTable.sha)
      .from(TreeTable)
      .where(eq(TreeTable.sha, this.sha))
      .get()
    if (!exists) throw new Error(`Missing source tree: ${this.sha}`)
    return this.#db
      .select({
        name: ChildTable.name,
        sha: ChildTable.sha,
        mode: ChildTable.mode,
        directory: ChildTable.directory
      })
      .from(ChildTable)
      .where(eq(ChildTable.treeSha, this.sha))
      .orderBy(ChildTable.name)
  }

  async get(path: string): Promise<TreeChild | undefined> {
    const segments = path.split('/')
    if (
      segments.some(segment => !segment || segment === '.' || segment === '..')
    )
      throw new Error(`Invalid source path: ${path}`)
    let sha = this.sha
    for (const [position, name] of segments.entries()) {
      const child = await this.#db
        .select({
          name: ChildTable.name,
          sha: ChildTable.sha,
          mode: ChildTable.mode,
          directory: ChildTable.directory
        })
        .from(ChildTable)
        .where(and(eq(ChildTable.treeSha, sha), eq(ChildTable.name, name)))
        .get()
      if (!child) return
      if (position === segments.length - 1) return child
      if (!child.directory) return
      sha = child.sha
    }
  }

  async toTree(): Promise<ReadonlyTree> {
    const entries: Array<Entry> = []
    for (const child of await this.children()) {
      entries.push({
        name: child.name,
        sha: child.sha,
        mode: child.mode,
        ...(child.directory
          ? {entries: (await new SqlTree(this.#db, child.sha).toTree()).entries}
          : {})
      })
    }
    return new ReadonlyTree({sha: this.sha, entries})
  }

  /** Rehashes only changed directories and their ancestors. */
  async withChanges(changes: ReadonlyArray<TreeChange>): Promise<SqlTree> {
    const pending = new Map<string, Array<TreeChild>>()
    const paths = new Set<string>()
    for (const change of changes) {
      if (
        change.path
          .split('/')
          .some(part => !part || part === '.' || part === '..')
      )
        throw new Error(`Invalid source path: ${change.path}`)
      if (paths.has(change.path))
        throw new Error(`Duplicate source path: ${change.path}`)
      paths.add(change.path)
      const actual = await this.get(change.path)
      const leaf = actual && !actual.directory ? actual : undefined
      if (
        leaf?.sha !== change.before?.sha ||
        leaf?.mode !== change.before?.mode
      )
        throw new Error(`Source changed at ${change.path}`)
      if (change.after && !['100644', '100755'].includes(change.after.mode))
        throw new Error(`Invalid source file mode: ${change.after.mode}`)
      if (change.after && !/^[a-f0-9]{40}$/.test(change.after.sha))
        throw new Error(`Invalid source blob hash: ${change.after.sha}`)
    }
    const db = this.#db
    async function update(
      sha: string | undefined,
      edits: ReadonlyArray<TreeChange>
    ): Promise<string> {
      const children = new Map(
        (sha ? await new SqlTree(db, sha).children() : []).map(child => [
          child.name,
          child
        ])
      )
      const descendants = new Map<string, Array<TreeChange>>()
      for (const change of edits) {
        const slash = change.path.indexOf('/')
        if (slash !== -1) {
          const name = change.path.slice(0, slash)
          const nested = descendants.get(name) ?? []
          nested.push({...change, path: change.path.slice(slash + 1)})
          descendants.set(name, nested)
        } else if (change.after) {
          children.set(change.path, {
            name: change.path,
            ...change.after,
            directory: false
          })
        } else children.delete(change.path)
      }
      for (const [name, nested] of descendants) {
        const original = sha ? await new SqlTree(db, sha).get(name) : undefined
        const nextSha = await update(
          original?.directory ? original.sha : undefined,
          nested
        )
        if (nextSha === ReadonlyTree.EMPTY.sha) {
          if (children.get(name)?.directory) children.delete(name)
          continue
        }
        if (children.has(name) && !children.get(name)!.directory)
          throw new Error(`Source path is both a file and directory: ${name}`)
        children.set(name, {
          name,
          sha: nextSha,
          mode: '040000',
          directory: true
        })
      }
      const rows = [...children.values()]
      const nextSha = await hashTree(
        serializeTreeEntries(
          rows.map(child => ({
            name: child.name,
            sha: child.sha,
            mode: child.mode,
            ...(child.directory ? {entries: []} : {})
          }))
        )
      )
      if (nextSha !== sha) pending.set(nextSha, rows)
      return nextSha
    }
    if (changes.length === 0) return this
    const sha = await update(this.sha, changes)
    await db.transaction(
      async tx => {
        for (const [hash, children] of pending) {
          if (
            await tx
              .select(TreeTable.sha)
              .from(TreeTable)
              .where(eq(TreeTable.sha, hash))
              .get()
          )
            continue
          await tx.insert(TreeTable).values({sha: hash})
          for (let offset = 0; offset < children.length; offset += 100)
            await tx
              .insert(ChildTable)
              .values(
                children
                  .slice(offset, offset + 100)
                  .map(child => ({treeSha: hash, ...child}))
              )
        }
      },
      {async: true}
    )
    return new SqlTree(db, sha)
  }

  /** Compares even across databases, skipping equal directory hashes. */
  async diff(next: SqlTree): Promise<TreeDifference> {
    const changes = new Map<string, TreeChange>()
    function record(path: string, side: 'before' | 'after', child: TreeChild) {
      const change = changes.get(path) ?? {path}
      change[side] = {sha: child.sha, mode: child.mode}
      changes.set(path, change)
    }
    async function walk(
      before: SqlTree | undefined,
      after: SqlTree | undefined,
      prefix: string
    ): Promise<void> {
      if (before && after && before.sha === after.sha) return
      const left = new Map(
        (await before?.children())?.map(child => [child.name, child])
      )
      const right = new Map(
        (await after?.children())?.map(child => [child.name, child])
      )
      const names = new Set([...left.keys(), ...right.keys()])
      for (const name of names) {
        const a = left.get(name)
        const b = right.get(name)
        if (a && b && a.sha === b.sha && a.mode === b.mode) continue
        const path = prefix + name
        if (a && !a.directory) record(path, 'before', a)
        if (b && !b.directory) record(path, 'after', b)
        if (a?.directory || b?.directory) {
          await walk(
            a?.directory && before ? new SqlTree(before.#db, a.sha) : undefined,
            b?.directory && after ? new SqlTree(after.#db, b.sha) : undefined,
            `${path}/`
          )
        }
      }
    }
    await walk(this, next, '')
    return {
      fromSha: this.sha,
      toSha: next.sha,
      changes: [...changes.values()].sort((a, b) =>
        compareStrings(a.path, b.path)
      )
    }
  }
}
