import type {EdgeQuery} from '#/core/Graph.js'
import {
  and,
  asc,
  Builder,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  not,
  sql,
  type Sql
} from 'rado'
import {EntryIndexTable as entry} from '../entry/Schema.js'

export interface RelationSource {
  id: string
  locale: string | null
  parentId: string | null
  parents: Array<string>
  level: number
  index: string
}

export const relationSource = {
  id: entry.id,
  locale: entry.locale,
  parentId: entry.parentId,
  parents: entry.parents,
  level: entry.level,
  index: entry.index
}

/** Restrict related identities in SQL before the query's own filters/paging. */
export function relationCondition(
  query: EdgeQuery,
  source: RelationSource
): Sql<boolean> {
  const locale =
    source.locale === null
      ? isNull(entry.locale)
      : eq(entry.locale, source.locale)
  switch (query.edge) {
    case 'parent':
      return source.parentId
        ? and(eq(entry.id, source.parentId), locale)
        : sql.value(false)
    case 'siblings':
      return source.parentId
        ? and(
            eq(entry.parentId, source.parentId),
            locale,
            query.includeSelf ? sql.value(true) : ne(entry.id, source.id)
          )
        : sql.value(false)
    case 'translations':
      return and(
        eq(entry.id, source.id),
        query.includeSelf
          ? sql.value(true)
          : not(sql`coalesce(${locale}, false)`)
      )
    case 'parents': {
      const ids = source.parents.slice(
        -(query.depth ?? Number.POSITIVE_INFINITY)
      )
      return and(inArray(entry.id, ids), locale)
    }
    case 'children': {
      const depth = query.depth ?? 1
      if (depth <= 0) return sql.value(false)
      if (depth === 1) return and(eq(entry.parentId, source.id), locale)
      const ancestor = sql.universal<boolean>({
        sqlite: sql`exists (select 1 from json_each(${entry.parents}) where value = ${source.id})`,
        postgres: sql`${entry.parents}::jsonb @> ${JSON.stringify([source.id])}::jsonb`,
        mysql: sql`json_contains(${entry.parents}, ${JSON.stringify(source.id)})`
      })
      return and(
        ancestor,
        locale,
        Number.isFinite(depth)
          ? lte(entry.level, source.level + depth)
          : sql.value(true)
      )
    }
    case 'next':
    case 'previous': {
      if (!source.parentId) return sql.value(false)
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
          asc(entry.ordinal)
        )
        .limit(1)
      return and(inArray(entry.id, neighbor), locale)
    }
    default:
      throw new Error(`SQL link relation is not implemented: ${query.edge}`)
  }
}
