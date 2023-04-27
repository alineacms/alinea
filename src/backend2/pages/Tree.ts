import {createId} from 'alinea/core/Id'
import {Cursor, CursorData, SourceType} from './Cursor.js'
import {Page} from './Page.js'
import {Selection} from './Selection.js'
import {Target, TargetI} from './Target.js'

type Narrow = Cursor.Find<any> | TargetI<any>
type Output<T> = [Narrow] extends [T] ? Page : Selection.Infer<T>

export class Tree {
  constructor(protected sourceId: string) {}

  protected narrowData(narrow?: any): Partial<CursorData> {
    return (
      narrow &&
      (Cursor.isCursor(narrow)
        ? narrow[Cursor.Data]
        : {target: narrow[Target.Data]})
    )
  }

  protected find<T>(sourceType: SourceType, narrow?: any): Cursor.Find<T> {
    return new Cursor.Find({
      id: createId(),
      ...this.narrowData(narrow),
      source: [sourceType, this.sourceId]
    })
  }

  protected get<T>(sourceType: SourceType, narrow?: any): Cursor.Get<T> {
    return new Cursor.Get({
      id: createId(),
      ...this.narrowData(narrow),
      first: true,
      source: [sourceType, this.sourceId]
    })
  }

  children = <N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> => {
    return this.find(SourceType.Children, narrow)
  }
  previous = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Previous, narrow)
  }
  next = <N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> => {
    return this.get(SourceType.Next, narrow)
  }
  parents = <N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> => {
    return this.find(SourceType.Parents, narrow)
  }
  /*parent=<N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> =>  {
    return this.find(SourceType.Parents, narrow).get()
  }*/
  siblings = <N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> => {
    return this.find(SourceType.Siblings, narrow)
  }
}
