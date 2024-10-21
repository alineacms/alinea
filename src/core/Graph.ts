import {Config} from './Config.js'
import {EntryFields} from './EntryFields.js'
import {Expr} from './Expr.js'
import {Filter} from './Filter.js'
import {PageSeed} from './Page.js'
import {PreviewRequest} from './Preview.js'
import {Resolver} from './Resolver.js'
import {Root} from './Root.js'
import {Type} from './Type.js'
import {Workspace} from './Workspace.js'

export type Location = Root | Workspace | PageSeed
type EmptyObject = Record<PropertyKey, never>

type FieldsOf<Types> = Types extends Type<infer V>
  ? V
  : Types extends Array<any>
  ? Types[number]
  : unknown

export interface RelatedQuery<Selection, Types>
  extends GraphQuery<Selection, Types> {
  translations?: EmptyObject
  children?: EmptyObject | {depth: number}
  parents?: EmptyObject
  siblings?: EmptyObject

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

interface Order {
  asc?: Expr<any>
  desc?: Expr<any>
}

type InferSelection<Selection> = Selection extends Expr<infer V>
  ? V
  : Selection extends Type<infer V>
  ? Type.Infer<V>
  : {
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
  extends QueryBase<Selection, Types> {
  /** Find a single entry or null */
  first?: true
  /** Find a single entry */
  get?: true
  /** Return the count of results found */
  count?: true
}

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
