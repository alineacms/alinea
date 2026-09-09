import {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {Graph} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import {internalSourceVersions} from '#/core/Internal.js'
import {entrySeeds} from '#/core/db/EntryIndex.js'
import type {CreateMutation} from '#/core/db/Mutation.js'
import {assert} from '#/core/util/Assert.js'

/** The caller commits each yielded seed and refreshes Graph before resuming.
 * Existing entries are located using structural index fields only.
 */
export async function* seedDatabase(
  config: Config,
  graph: Graph
): AsyncGenerator<CreateMutation> {
  const offset = Config.multipleWorkspaces(config) ? 2 : 1
  for (const [nodePath, seed] of entrySeeds(config)) {
    const {type, workspace, root, locale} = seed
    const segments = nodePath.split('/').slice(offset)
    const seedPath = `/${segments.join('/')}.json`
    const parts = segments.slice(locale ? 1 : 0)
    const path = parts.at(-1)!
    const scope = {
      workspace,
      root,
      locale,
      status: 'all' as const,
      [internalSourceVersions]: true
    }
    let parentId: string | null = null
    let parentFound = true
    for (const part of parts.slice(0, -1)) {
      const parent: string | null = await graph.first({
        ...scope,
        parentId,
        path: part,
        select: Entry.id
      })
      if (!parent) {
        parentFound = false
        break
      }
      parentId = parent
    }
    const atPath = parentFound
      ? await graph.first({
          ...scope,
          parentId,
          path,
          select: Entry.type
        })
      : null
    const existing =
      atPath ??
      (
        await graph.find({
          workspace,
          root,
          status: 'all',
          select: {seeded: Entry.seeded, type: Entry.type}
        })
      ).find(entry => entry.seeded === seedPath)?.type
    if (existing) {
      assert(existing === type, `Type mismatch in ${nodePath}`)
      continue
    }
    if (!parentFound) parentId = null
    const translation = locale
      ? (
          await graph.find({
            workspace,
            root,
            parentId,
            path,
            level: parts.length - 1,
            status: 'all',
            filter: {_locale: {isNot: locale}},
            select: {id: Entry.id, seeded: Entry.seeded}
          })
        ).find(entry => entry.seeded?.endsWith(`/${parts.join('/')}.json`))?.id
      : null
    yield {
      op: 'create',
      id: translation ?? createId(),
      parentId,
      locale,
      type,
      workspace,
      root,
      fromSeed: seedPath,
      data: {path}
    }
  }
}
