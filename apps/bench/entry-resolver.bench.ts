import {createCMS} from 'alinea/adapter/core/cms'
import * as Config from 'alinea/config'
import {number} from 'alinea/field/number'
import {path as pathField} from 'alinea/field/path'
import {text} from 'alinea/field/text'
import * as Query from 'alinea/query'
import {bench, run} from 'mitata'
import {
  createEntryResolver,
  type EntryFixtureEntry
} from '../../src/test/EntryFixture'

const BenchPage = Config.document('BenchPage', {
  fields: {
    title: text('Title'),
    path: pathField('Path'),
    score: number('Score'),
    category: text('Category')
  }
})

const main = Config.workspace('Main', {
  source: 'content/main',
  roots: {
    pages: Config.root('Pages', {
      contains: ['BenchPage']
    })
  }
})

const cms = createCMS({
  schema: {BenchPage},
  workspaces: {main}
})

function buildEntries(size: number): Array<EntryFixtureEntry> {
  const parent: EntryFixtureEntry = {
    id: 'parent',
    type: 'BenchPage',
    index: 'a1',
    path: 'parent',
    data: {title: 'Parent', score: size + 1, category: 'root'}
  }
  const children = Array.from({length: size}, (_, i) => {
    const index = `a${i + 1}`
    return {
      id: `child-${i}`,
      type: 'BenchPage',
      index,
      parentPaths: ['parent'],
      path: `child-${i}`,
      data: {
        title: `Child ${i}`,
        score: size - i,
        category: `cat-${i % 20}`
      }
    } satisfies EntryFixtureEntry
  })
  return [parent, ...children]
}

type BenchStats = {
  median: number
  min: number
  max: number
}

function nsToMs(value: number) {
  return value / 1_000_000
}

function collectStats(result: Awaited<ReturnType<typeof run>>) {
  const rows: Array<{name: string} & BenchStats> = []
  for (const trial of result.benchmarks) {
    for (const sample of trial.runs) {
      if (sample.error || !sample.stats) continue
      rows.push({
        name: sample.name,
        median: nsToMs(sample.stats.p50),
        min: nsToMs(sample.stats.min),
        max: nsToMs(sample.stats.max)
      })
    }
  }
  return rows
}

async function mainBench() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const sizeArg = args.find(arg => !arg.startsWith('-'))
  const size = Number(sizeArg ?? 2000)
  const {resolver} = await createEntryResolver(cms.config, buildEntries(size))
  const targetId = `child-${Math.floor(size / 2)}`
  const siblingId = `child-${Math.floor(size / 3)}`
  const sampledIds = Array.from({length: 200}, (_, i) => `child-${i * 3}`)

  bench('count pages', async () => {
    await resolver.resolve({
      type: BenchPage,
      count: true
    })
  })
  bench('count filtered', async () => {
    await resolver.resolve({
      type: BenchPage,
      filter: {score: {gte: Math.floor(size / 2)}} as any,
      count: true
    })
  })
  bench('id.in lookup', async () => {
    await resolver.resolve({
      type: BenchPage,
      id: {in: sampledIds},
      select: Query.id
    })
  })
  bench('orderBy score asc', async () => {
    await resolver.resolve({
      type: BenchPage,
      orderBy: {asc: BenchPage.score},
      take: 25,
      select: Query.id
    })
  })
  bench('orderBy + paging', async () => {
    await resolver.resolve({
      type: BenchPage,
      orderBy: {asc: BenchPage.score},
      skip: 200,
      take: 50,
      select: Query.id
    })
  })
  bench('groupBy category', async () => {
    await resolver.resolve({
      type: BenchPage,
      groupBy: BenchPage.category,
      select: Query.id
    })
  })
  bench('edge next', async () => {
    await resolver.resolve({
      first: true,
      id: targetId,
      select: Query.next({select: Query.id})
    })
  })
  bench('edge previous', async () => {
    await resolver.resolve({
      first: true,
      id: targetId,
      select: Query.previous({select: Query.id})
    })
  })
  bench('edge siblings', async () => {
    await resolver.resolve({
      first: true,
      id: siblingId,
      select: Query.siblings({select: Query.id})
    })
  })
  bench('edge children', async () => {
    await resolver.resolve({
      first: true,
      id: 'parent',
      select: Query.children({select: Query.id})
    })
  })

  const result = await run({
    throw: true,
    colors: !json,
    format: json ? 'quiet' : 'mitata'
  })
  const rows = collectStats(result)
  if (json) {
    console.log(JSON.stringify({size, rows}))
    return
  }
  console.log('')
  console.log(`EntryResolver benchmark summary size=${size}`)
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(24)} median=${row.median.toFixed(3)}ms  min=${row.min.toFixed(3)}ms  max=${row.max.toFixed(3)}ms`
    )
  }
}

await mainBench()
