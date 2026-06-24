import type {LocalConnection} from '../Connection.js'
import {type User, localUser} from '../User.js'
import {LocalDB} from './LocalDB.js'

export class TestDB extends LocalDB implements LocalConnection {
  async previewToken(): Promise<string> {
    return 'dev'
  }

  async user(): Promise<User> {
    return localUser
  }

  async enrichUser(user: User): Promise<User> {
    return user
  }

  async listUsers(): Promise<Array<User>> {
    return [localUser]
  }

  async createUser(user: User): Promise<User> {
    return user
  }

  async updateUser(user: User): Promise<User> {
    return user
  }

  async revisions() {
    return []
  }

  async revisionData() {
    return undefined
  }

  async getDraft() {
    return undefined
  }

  async storeDraft() {}
}
