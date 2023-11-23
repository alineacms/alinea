import {Entry} from '../Entry.js'
import {Cursor, CursorData, SourceType} from './Cursor.js'
import {Selection} from './Selection.js'
import {Target, TargetI} from './Target.js'

type Narrow = Cursor.Find<any> | TargetI<any>
type Output<T> = [Narrow] extends [T] ? Entry : Selection.Infer<T>

export class Tree {
  constructor(/*protected sourceId: string*/) {
    this.children = this.children.bind(this)
    this.parents = this.parents.bind(this)
  }

  protected narrowData(narrow?: any): Partial<CursorData> {
    return (
      narrow &&
      (Cursor.isCursor(narrow)
        ? narrow[Cursor.Data]
        : {target: narrow[Target.Data]})
    )
  }

  protected find<T>(
    sourceType: SourceType,
    narrow?: any,
    depth?: number
  ): Cursor.Find<T> {
    return new Cursor.Find({
      ...this.narrowData(narrow),
      source: {type: sourceType, depth}
    })
  }

  protected get<T>(sourceType: SourceType, narrow?: any): Cursor.Get<T> {
    return new Cursor.Get({
      ...this.narrowData(narrow),
      first: true,
      source: {type: sourceType}
    })
  }

  children<N extends Narrow>(depth?: number): Cursor.Find<Output<N>>
  children<N extends Narrow>(narrow?: N, depth?: number): Cursor.Find<Output<N>>
  children<N extends Narrow>(
    narrow?: N | number,
    depth?: number
  ): Cursor.Find<Output<N>> {
    ;[narrow, depth] =
      typeof narrow === 'number' ? [undefined, narrow] : [narrow, depth || 1]
    return this.find(SourceType.Children, narrow, depth)
  }
  parents<N extends Narrow>(depth?: number): Cursor.Find<Output<N>>
  parents<N extends Narrow>(narrow?: N, depth?: number): Cursor.Find<Output<N>>
  parents<N extends Narrow>(
    narrow?: N | number,
    depth?: number
  ): Cursor.Find<Output<N>> {
    ;[narrow, depth] =
      typeof narrow === 'number' ? [undefined, narrow] : [narrow, depth]
    return this.find(SourceType.Parents, narrow, depth)
  }
  previous = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Previous, narrow)
  }
  next = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Next, narrow)
  }
  parent = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Parent, narrow)
  }
  siblings = <N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> => {
    return this.find(SourceType.Siblings, narrow)
  }
  translations = (includeSelf = false): Cursor.Find<Entry> => {
    return this.find(SourceType.Translations)
  }
}
