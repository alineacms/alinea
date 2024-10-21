import * as cito from 'cito'
import {Config} from './Config.js'
import {EntryFields} from './EntryFields.js'
import {Expr, EXPR_KEY} from './Expr.js'
import {Filter} from './Filter.js'
import {PageSeed} from './Page.js'
import {PreviewRequest} from './Preview.js'
import {Resolver} from './Resolver.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Type, TYPE_KEY} from './Type.js'
import {hasExact} from './util/Checks.js'
import {keys} from './util/Objects.js'
import {Workspace} from './Workspace.js'

export type Location = Root | Workspace | PageSeed | Array<string>
type EmptyObject = Record<PropertyKey, never>

type FieldsOf<Types> = Types extends Type<infer V>
  ? V
  : Types extends Array<any>
  ? Types[number]
  : unknown

export interface RelatedQuery<Selection = unknown, Types = unknown>
  extends GraphQuery<Selection, Types> {
  translations?: EmptyObject | {includeSelf: boolean}
  children?: EmptyObject | {depth: number}
  parents?: EmptyObject | {depth: number}
  siblings?: EmptyObject | {includeSelf: boolean}

  parent?: EmptyObject
  next?: EmptyObject
  previous?: EmptyObject
}

type IsRelated =
  | {translations: EmptyObject}
  | {children: EmptyObject | {depth: number}}
  | {parents: EmptyObject}
  | {siblings: EmptyObject}
  | {parent: EmptyObject}
  | {next: EmptyObject}
  | {previous: EmptyObject}

interface ToSelect {
  [key: string]:
    | Expr<any>
    | RelatedQuery<ToSelect | Expr<any>, Type | Array<Type>>
    | ToSelect
}

export type Projection = ToSelect | Expr<any>
export type InferProjection<Selection> = InferSelection<Selection>

export interface Order {
  asc?: Expr<any>
  desc?: Expr<any>
  caseSensitive?: boolean
}

type InferSelection<Selection> = Selection extends Expr<infer V>
  ? V
  : Selection extends Type<infer V>
  ? Type.Infer<V>
  : EntryFields & {
      [K in keyof Selection]: Selection[K] extends Type<infer V>
        ? Type.Infer<V>
        : Selection[K] extends Expr<infer V>
        ? V
        : Selection[K] extends GraphQuery & IsRelated
        ? AnyQueryResult<Selection[K]>
        : InferSelection<Selection[K]>
    }

type InferResult<Selection, Types> = Selection extends undefined
  ? Types extends undefined
    ? EntryFields
    : Type.Infer<Types>
  : InferSelection<Selection>

type CountQueryResult<Selection, Types> = number
type GetQueryResult<Selection, Types> = InferResult<Selection, Types>
type FirstQueryResult<Selection, Types> = InferResult<Selection, Types> | null
type FindQueryResult<Selection, Types> = Array<InferResult<Selection, Types>>

export type AnyQueryResult<Query extends GraphQuery> = Query extends {
  count: true
}
  ? CountQueryResult<Query['select'], Query['type']>
  : Query extends {first: true}
  ? FirstQueryResult<Query['select'], Query['type']>
  : Query extends {get: true}
  ? GetQueryResult<Query['select'], Query['type']>
  : FindQueryResult<Query['select'], Query['type']>

export type Status =
  /** Only published entries */
  | 'published'
  /** Only drafts */
  | 'draft'
  /** Only archived entries */
  | 'archived'
  /** Prefer drafts, then published, then archived */
  | 'preferDraft'
  /** Prefer published, then archived, then drafts */
  | 'preferPublished'
  /** All phases */
  | 'all'

export declare class QuerySettings {
  /** Find a single entry or null */
  first?: true
  /** Find a single entry */
  get?: true
  /** Return the count of results found */
  count?: true

  filter?: Filter<EntryFields>

  /** Filter results by location */
  location?: Location
  /** Filter results by locale */
  locale?: string

  search?: string | Array<string>

  /** The time in seconds to poll for updates to content */
  syncInterval?: number
  /** Disable polling for updates to content */
  disableSync?: boolean

  /** Skip the first N results */
  skip?: number
  /** Return the first N results */
  take?: number

  /** Group results by one or more fields */
  groupBy?: Expr<any> | Array<Expr<any>>
  /** Order results by one or more fields */
  orderBy?: Order | Array<Order>

  /** Change status to include drafts or archived entries */
  status?: Status

  /** Preview an entry */
  preview?: PreviewRequest
}

export interface QueryBase<Selection, Types> extends QuerySettings {
  select?: Selection
  type?: Types
  filter?: Filter<EntryFields & FieldsOf<Types>>
}

export interface QueryWithResult<Result> extends QuerySettings {
  select: Result extends object
    ? {
        [K in keyof Result]: Expr<Result[K]>
      }
    : Expr<Result>
}

export interface QueryInput<Selection, Types> extends QuerySettings {
  select?: Selection
  filter?: Filter<EntryFields & FieldsOf<Types>>
}

export interface GraphQuery<Selection = unknown, Types = unknown>
  extends QueryBase<Selection, Types> {}

type SelectionGuard = Projection | undefined
type TypeGuard = Type | Array<Type> | undefined

export class Graph {
  #resolver: Resolver

  constructor(public config: Config, resolver: Resolver) {
    this.#resolver = resolver
  }

  find<Selection extends SelectionGuard, Type extends TypeGuard>(
    query: GraphQuery<Selection, Type>
  ): Promise<FindQueryResult<Selection, Type>> {
    return <any>this.#resolver.resolve(query)
  }

  first<Selection extends SelectionGuard, Type extends TypeGuard>(
    query: GraphQuery<Selection, Type>
  ): Promise<FirstQueryResult<Selection, Type>> {
    return <any>this.#resolver.resolve({...query, first: true})
  }

  get<Selection extends SelectionGuard, Type extends TypeGuard>(
    query: GraphQuery<Selection, Type>
  ): Promise<GetQueryResult<Selection, Type>> {
    return <any>this.#resolver.resolve({...query, get: true})
  }

  count<Selection extends SelectionGuard, Type extends TypeGuard>(
    query: GraphQuery<Selection, Type>
  ): Promise<CountQueryResult<Selection, Type>> {
    return <any>this.#resolver.resolve({...query, count: true})
  }
}

export function parseQuery(schema: Schema, input: string): GraphQuery {
  return JSON.parse(input, (key, value) => {
    if (value && typeof value === 'object') {
      const props = keys(value)
      if (props.length === 1) {
        const [key] = keys(value)
        if (key === TYPE_KEY) return schema[value.name]
        else if (key === EXPR_KEY) return value.type[value.name]
      }
    }
    return value
  })
}

const emptySource = cito.object({}).and(hasExact([]))
const depthSource = cito
  .object({depth: cito.number.optional})
  .and(hasExact(['depth']))
const includeSource = cito
  .object({includeSelf: cito.boolean.optional})
  .and(hasExact(['includeSelf']))
const translationsSource = cito.object({translations: includeSource})
const childrenSource = cito.object({children: depthSource})
const parentsSource = cito.object({parents: depthSource})
const siblingsSource = cito.object({siblings: includeSource})

const parentSource = cito.object({parent: emptySource})
const nextSource = cito.object({next: emptySource})
const prevSource = cito.object({previous: emptySource})

export function querySource(query: unknown) {
  if (!query || typeof query !== 'object') return
  if (translationsSource.check(query)) return 'translations'
  if (childrenSource.check(query)) return 'children'
  if (parentsSource.check(query)) return 'parents'
  if (siblingsSource.check(query)) return 'siblings'
  if (parentSource.check(query)) return 'parent'
  if (nextSource.check(query)) return 'next'
  if (prevSource.check(query)) return 'previous'
}
