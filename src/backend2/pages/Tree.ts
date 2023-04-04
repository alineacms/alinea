import {Select, SelectFirst} from './Cursor.js'
import {Page} from './Page.js'

export class Tree {
  children(): Select<Page> {
    throw 'todo'
  }
  previous(): SelectFirst<Page> {
    throw 'todo'
  }
  next(): SelectFirst<Page> {
    throw 'todo'
  }
  parents(): Select<Page> {
    throw 'todo'
  }
  parent(): SelectFirst<Page> {
    throw 'todo'
  }
  siblings(): Select<Page> {
    throw 'todo'
  }
}
