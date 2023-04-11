import {Cursor} from './Cursor.js'
import {Page} from './Page.js'
import {Query} from './Query.js'
import {TargetI} from './Target.js'

type Narrow = Cursor.Find<any> | TargetI<any>
type Output<T> = [T] extends [undefined] ? Page : Query.Infer<T>

export class Tree {
  children<N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> {
    throw 'todo'
  }
  previous<N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> {
    throw 'todo'
  }
  next<N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> {
    throw 'todo'
  }
  parents<N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> {
    throw 'todo'
  }
  parent<N extends Narrow>(narrow?: N): Cursor.Get<Output<N>> {
    throw 'todo'
  }
  siblings<N extends Narrow>(narrow?: N): Cursor.Find<Output<N>> {
    throw 'todo'
  }
}
