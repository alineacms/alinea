import {Config} from './Config.js'
import {EntryFields} from './EntryFields.js'
import {Filter} from './Filter.js'
import {PageSeed} from './Page.js'
import {PreviewRequest} from './Preview.js'
import {Resolver} from './Resolver.js'
import {Root} from './Root.js'
import {Type} from './Type.js'
import {Workspace} from './Workspace.js'
import {Expr} from './pages/Expr.js'
import {Target} from './pages/index.js'

export type Location = Root | Workspace | PageSeed
type EmptyObject = Record<PropertyKey, never>

type FieldsOf<Types> = Types extends Type<infer V>
  ? V
  : Types extends Array<any>
  ? Types[number]
  : never

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

interface Order {
  asc?: Expr<any>
  desc?: Expr<any>
}

type InferSelection<Selection> = Selection extends Expr<infer V>
  ? V
  : Selection extends Target<infer V>
  ? V
  : Selection extends Type<infer V>
  ? Type.Infer<V>
  : {
      [K in keyof Selection]: Selection[K] extends Target<infer V>
        ? V
        : Selection[K] extends Type<infer V>
        ? Type.Infer<V>
        : Selection[K] extends Expr<infer V>
        ? V
        : Selection[K] extends IsRelated
        ? AnyQueryResult<Selection[K]>
        : InferSelection<Selection[K]>
    }

type InferResult<Query> = Query extends {select: infer Selection}
  ? InferSelection<Selection>
  : Query extends {type: infer Types}
  ? Type.Infer<Types>
  : EntryFields

type CountQueryResult<Query> = number
type GetQueryResult<Query> = InferResult<Query>
type FirstQueryResult<Query> = InferResult<Query> | null
type FindQueryResult<Query> = Array<InferResult<Query>>

export type AnyQueryResult<Query> = Query extends {count: true}
  ? CountQueryResult<Query>
  : Query extends {first: true}
  ? FirstQueryResult<Query>
  : Query extends {get: true}
  ? GetQueryResult<Query>
  : FindQueryResult<Query>

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

export interface GraphQuery<Selection = unknown, Types = Type | Array<Type>>
  extends QueryBase<Selection, Types> {
  /** Find a single entry or null */
  first?: true
  /** Find a single entry */
  get?: true
  /** Return the count of results found */
  count?: true
}

export class Graph {
  #resolver: Resolver

  constructor(public config: Config, resolver: Resolver) {
    this.#resolver = resolver
  }

  find<
    const Types extends Type | Array<Type>,
    Query extends QueryInput<ToSelect | Expr<any> | Target<any>, Types>
  >(query: Query): Promise<FindQueryResult<Query>> {
    return this.#resolver.resolve(query) as Promise<FindQueryResult<Query>>
  }

  first<
    const Types extends Type | Array<Type>,
    Query extends QueryInput<ToSelect | Expr<any> | Target<any>, Types>
  >(query: Query): Promise<FirstQueryResult<Query>> {
    return this.#resolver.resolve({...query, first: true}) as Promise<
      FirstQueryResult<Query>
    >
  }

  get<
    const Types extends Type | Array<Type>,
    Query extends QueryInput<ToSelect | Expr<any> | Target<any>, Types>
  >(query: Query): Promise<GetQueryResult<Query>> {
    return this.#resolver.resolve({...query, get: true}) as Promise<
      GetQueryResult<Query>
    >
  }

  count<
    const Types extends Type | Array<Type>,
    Query extends QueryInput<ToSelect | Expr<any> | Target<any>, Types>
  >(query: Query): Promise<CountQueryResult<Query>> {
    return this.#resolver.resolve({...query, count: true}) as Promise<
      CountQueryResult<Query>
    >
  }
}
