import type {LocalConnection} from '../Connection.js'
import {type User, type UserInput, localUser} from '../User.js'
import {LocalDB} from './LocalDB.js'

export class TestDB extends LocalDB implements LocalConnection {
  async previewToken(): Promise<string> {
    return 'dev'
  }

  async user(): Promise<User> {
    return localUser
  }

  async enrichUser(user: UserInput): Promise<User> {
    return {
      ...user,
      sub: user.sub ?? user.email
    }
  }

  async listUsers(): Promise<Array<User>> {
    return [localUser]
  }

  async createUser(user: UserInput): Promise<User> {
    return {
      ...user,
      sub: user.sub ?? user.email
    }
  }

  async updateUser(user: UserInput): Promise<User> {
    return {
      ...user,
      sub: user.sub ?? user.email
    }
  }

  async removeUser() {}

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
