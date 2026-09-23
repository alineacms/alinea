import type {EdgeQuery} from '#/core/Graph.js'
import {
  and,
  alias,
  asc,
  Builder,
  desc,
  eq,
  getSql,
  gt,
  gte,
  inArray,
  lt,
  lte,
  ne,
  not,
  sql,
  type Sql
} from 'rado'
import type {EntryIndexTarget} from '../entry/EntryTable.js'
import {jsonField} from './Condition.js'

/** Expand the stored references as SQL rows, retaining list order and duplicates. */
export function linkRelation(
  source: EntryIndexTarget,
  field: string,
  multiple: boolean
) {
  const value = getSql(jsonField(source.data, [field])).forSelection()
  const array = multiple ? value : sql`json_array(json(${value}))`
  return {
    target: sql`(select json_extract(value, '$._entry') as id, key as ordinal from json_each(${array}) where type = 'object') as alinea_link`,
    id: sql<string>`alinea_link.id`,
    ordinal: sql<number>`alinea_link.ordinal`
  }
}

/** Restrict related identities in SQL before the query's own filters/paging. */
export function relationCondition(
  entry: EntryIndexTarget,
  query: EdgeQuery,
  source: EntryIndexTarget
): Sql<boolean> {
  const locale = sql<boolean>`${entry.locale} is ${source.locale}`
  switch (query.edge) {
    case 'parent':
      return and(eq(entry.id, source.parentId), locale)
    case 'siblings':
      return and(
        eq(entry.parentId, source.parentId),
        locale,
        query.includeSelf ? sql.value(true) : ne(entry.id, source.id)
      )
    case 'translations':
      return and(
        eq(entry.id, source.id),
        query.includeSelf
          ? sql.value(true)
          : not(sql`coalesce(${locale}, false)`)
      )
    case 'parents': {
      const depth = query.depth ?? Number.POSITIVE_INFINITY
      if (depth <= 0) return sql.value(false)
      const ids = new Builder()
        .select(sql<string>`value`)
        .from(sql`json_each(${source.parents})`)
        .where(
          Number.isFinite(depth)
            ? gte(
                sql<number>`key`,
                sql<number>`json_array_length(${source.parents}) - ${depth}`
              )
            : sql.value(true)
        )
      return and(inArray(entry.id, ids), locale)
    }
    case 'children': {
      const depth = query.depth ?? 1
      if (depth <= 0) return sql.value(false)
      if (depth === 1) return and(eq(entry.parentId, source.id), locale)
      const Child = alias(entry, 'alinea_descendant')
      const descendants = new Builder().$with('alinea_descendants').as(
        new Builder()
          .select({
            id: source.id,
            level: sql<number>`0`
          })
          .unionAll(self =>
            new Builder()
              .select({
                id: Child.id,
                level: sql<number>`${self.level} + 1`
              })
              .from(Child)
              .innerJoin(self, eq(Child.parentId, self.id))
              .where(
                sql<boolean>`${Child.locale} is ${source.locale}`,
                Number.isFinite(depth)
                  ? lte(sql<number>`${self.level} + 1`, Math.min(depth, 999))
                  : sql.value(true)
              )
          )
      )
      const ids = new Builder()
        .withRecursive(descendants)
        .select(descendants.id)
        .from(descendants)
        .limit(Number.MAX_SAFE_INTEGER)
        .offset(1)
      return and(inArray(entry.id, ids), locale)
    }
    case 'next':
    case 'previous': {
      const next = query.edge === 'next'
      const neighbor = new Builder()
        .select(entry.id)
        .from(entry)
        .where(
          and(
            eq(entry.parentId, source.parentId),
            locale,
            next ? gt(entry.index, source.index) : lt(entry.index, source.index)
          )
        )
        .orderBy(
          next ? asc(entry.index) : desc(entry.index),
          asc(entry.filePath),
          asc(entry.versionId)
        )
        .limit(1)
      return and(inArray(entry.id, neighbor), locale)
    }
    default:
      throw new Error(`SQL link relation is not implemented: ${query.edge}`)
  }
}
