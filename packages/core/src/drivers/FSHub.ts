import {Entry, Hub, Content, Id, Label} from '../Hub'
import {promises} from 'fs'

export class FSContent implements Content {
  constructor(public path: string) {}

  async list(): Promise<Array<Entry>> {
    const files = await promises.readdir(this.path)
    return files.map(file => ({
      id: file as Id<Entry>,
      title: Label({en: file})
    }))
  }
}

export class FSHub implements Hub {
  constructor(public path: string) {}

  content = new FSContent(this.path)
}
