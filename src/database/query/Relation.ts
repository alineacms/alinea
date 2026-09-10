import type {EdgeQuery} from '#/core/Graph.js'
import {
  and,
  asc,
  Builder,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  not,
  sql,
  when,
  type Sql
} from 'rado'
import {EntryIndexTable as entry} from '../entry/Schema.js'
import {jsonField} from './Condition.js'

export interface RelationSource {
  versionId: string
  id: string
  locale: string | null
  parentId: string | null
  parents: Array<string>
  level: number
  index: string
}

export const relationSource = {
  versionId: entry.versionId,
  id: entry.id,
  locale: entry.locale,
  parentId: entry.parentId,
  parents: entry.parents,
  level: entry.level,
  index: entry.index
}

/** Expand the stored references as SQL rows, retaining list order and duplicates. */
export function linkRelation(
  source: RelationSource,
  field: string,
  multiple: boolean
) {
  const payload = new Builder()
    .select(jsonField(entry.data, [field]).selection!)
    .from(entry)
    .where(eq(entry.versionId, source.versionId))
  const value = sql`(${payload})`
  const kind = sql.universal<string>({
    sqlite: sql`json_type(${value})`,
    postgres: sql`jsonb_typeof(${value}::jsonb)`,
    mysql: sql`lower(json_type(${value}))`
  })
  const asArray = sql.universal({
    sqlite: multiple ? value : sql`json_array(json(${value}))`,
    postgres: multiple
      ? sql`${value}::jsonb`
      : sql`jsonb_build_array(${value}::jsonb)`,
    mysql: multiple ? value : sql`json_array(${value})`
  })
  const empty = sql.universal({
    sqlite: sql.value('[]'),
    postgres: sql`'[]'::jsonb`,
    mysql: sql`json_array()`
  })
  const array = when([eq(kind, multiple ? 'array' : 'object'), asArray], empty)
  return {
    target: sql.universal({
      sqlite: sql`(select json_extract(value, '$._entry') as id, key as ordinal from json_each(${array}) where type = 'object') as alinea_link`,
      postgres: sql`(select value ->> '_entry' as id, ordinality as ordinal from jsonb_array_elements(${array}) with ordinality) as alinea_link`,
      mysql: sql`json_table(${array}, '$[*]' columns (id varchar(128) path '$._entry', ordinal for ordinality)) as alinea_link`
    }),
    id: sql<string>`alinea_link.id`,
    ordinal: sql<number>`alinea_link.ordinal`
  }
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
        sqlite: exists(
          new Builder()
            .select(sql.value(1))
            .from(sql`json_each(${entry.parents})`)
            .where(eq(sql`value`, source.id))
        ),
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
