import {Index} from './Index'

export class LocalHub {
  constructor(protected contentPath: string) {}
  content = new Index(this.contentPath)
}
