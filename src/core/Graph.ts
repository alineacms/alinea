import {Root, Workspace} from 'alinea/types'
import * as cito from 'cito'
import {Config} from './Config.js'
import {EntryFields} from './EntryFields.js'
import {Expr} from './Expr.js'
import {Filter} from './Filter.js'
import {PageSeed} from './Page.js'
import {PreviewRequest} from './Preview.js'
import {Resolver} from './Resolver.js'
import {Type} from './Type.js'
import {hasExact} from './util/Checks.js'
import {Expand} from './util/Types.js'

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
  | {translations: EmptyObject | {includeSelf: boolean}}
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
  : {
      [K in keyof Selection]: Selection[K] extends Type<infer V>
        ? Type.Infer<V>
        : Selection[K] extends Expr<infer V>
        ? V
        : Selection[K] extends GraphQuery & IsRelated
        ? Expand<AnyQueryResult<Selection[K]>>
        : InferSelection<Selection[K]>
    }

type InferResult<Selection, Types, Include> = Selection extends Expr<
  infer Value
>
  ? Value
  : Selection extends undefined
  ? Types extends undefined
    ? EntryFields & (Include extends undefined ? {} : InferSelection<Include>)
    : Type.Infer<Types> &
        EntryFields &
        (Include extends undefined ? {} : InferSelection<Include>)
  : InferSelection<Selection>

type CountQueryResult<Selection, Types, Include> = number
type GetQueryResult<Selection, Types, Include> = Expand<
  InferResult<Selection, Types, Include>
>
type FirstQueryResult<Selection, Types, Include> = Expand<
  InferResult<Selection, Types, Include>
> | null
type FindQueryResult<Selection, Types, Include> = Expand<
  Array<InferResult<Selection, Types, Include>>
>

interface CountQuery<Selection, Types, Include>
  extends GraphQuery<Selection, Types, Include> {
  count: true
}
type FirstQuery<Selection, Types, Include> =
  | (GraphQuery<Selection, Types, Include> & {first: true})
  | (GraphQuery<Selection, Types, Include> & {next: EmptyObject})
  | (GraphQuery<Selection, Types, Include> & {previous: EmptyObject})
  | (GraphQuery<Selection, Types, Include> & {parent: EmptyObject})
interface GetQuery<Selection, Types, Include>
  extends GraphQuery<Selection, Types, Include> {
  get: true
}

export type AnyQueryResult<Query extends GraphQuery> = Query extends CountQuery<
  infer S,
  infer T,
  infer I
>
  ? CountQueryResult<S, T, I>
  : Query extends FirstQuery<infer S, infer T, infer I>
  ? FirstQueryResult<S, T, I>
  : Query extends GetQuery<infer S, infer T, infer I>
  ? GetQueryResult<S, T, I>
  : Query extends GraphQuery<infer S, infer T, infer I>
  ? FindQueryResult<S, T, I>
  : unknown

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

export interface QueryBase<Selection, Types, Include> extends QuerySettings {
  type?: Types
  select?: Selection
  include?: Include
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

export interface GraphQuery<
  Selection = unknown,
  Types = unknown,
  Include = unknown
> extends QueryBase<Selection, Types, Include> {}

type SelectionGuard = Projection | undefined
type TypeGuard = Type | Array<Type> | undefined
type IncludeGuard = ToSelect | undefined

export class Graph {
  #resolver: Resolver

  constructor(public config: Config, resolver: Resolver) {
    this.#resolver = resolver
  }

  find<
    Selection extends SelectionGuard = undefined,
    Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query: GraphQuery<Selection, Type, Include>
  ): Promise<FindQueryResult<Selection, Type, Include>> {
    return <any>this.#resolver.resolve(query)
  }

  first<
    Selection extends SelectionGuard = undefined,
    Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query: GraphQuery<Selection, Type, Include>
  ): Promise<FirstQueryResult<Selection, Type, Include>> {
    return <any>this.#resolver.resolve({...query, first: true})
  }

  get<
    Selection extends SelectionGuard = undefined,
    Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query: GraphQuery<Selection, Type, Include>
  ): Promise<GetQueryResult<Selection, Type, Include>> {
    return <any>this.#resolver.resolve({...query, get: true})
  }

  count<
    Selection extends SelectionGuard = undefined,
    Type extends TypeGuard = undefined,
    Include extends IncludeGuard = undefined
  >(
    query: GraphQuery<Selection, Type, Include>
  ): Promise<CountQueryResult<Selection, Type, Include>> {
    return <any>this.#resolver.resolve({...query, count: true})
  }
}

const plainObject = cito.type((value): value is object => {
  return value?.constructor === Object
})
const emptySource = plainObject.and(hasExact([]))
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
  if (query?.constructor !== Object) return
  if (translationsSource.check(query)) return 'translations'
  if (childrenSource.check(query)) return 'children'
  if (parentsSource.check(query)) return 'parents'
  if (siblingsSource.check(query)) return 'siblings'
  if (parentSource.check(query)) return 'parent'
  if (nextSource.check(query)) return 'next'
  if (prevSource.check(query)) return 'previous'
}
