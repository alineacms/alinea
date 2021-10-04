import {Persistence} from '../Persistence'

export class GitPersistence implements Persistence {
  constructor() {}

  async get(key: string): Promise<Buffer | undefined> {
    // this.git.hashObject()
    return undefined
  }

  async set(key: string, buffer: Buffer): Promise<void> {}
}
