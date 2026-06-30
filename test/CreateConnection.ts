import type {
  BackendCapabilities,
  LocalConnection,
  Revision
} from '#/core/Connection.js'
import type {LocalDB} from '#/core/db/LocalDB.js'
import type {User, UserInput} from '#/core/User.js'
import {localUser} from '#/core/User.js'

interface TestConnectionOptions {
  capabilities?: BackendCapabilities
  previewToken?: string
  user?: User
  users?: Array<User>
}

interface ConnectionOverrides
  extends Partial<
    Pick<
      LocalConnection,
      'getDraft' | 'previewToken' | 'revisionData' | 'revisions' | 'storeDraft'
    >
  > {}

export function createTestConnection(
  db: LocalDB & ConnectionOverrides,
  options: TestConnectionOptions = {}
): LocalConnection {
  const currentUser: User = options.user ?? localUser
  let users = options.users?.slice() ?? [currentUser]
  return {
    capabilities() {
      return Promise.resolve(options.capabilities ?? {users: true})
    },
    mutate(mutations) {
      return db.mutate(mutations)
    },
    previewToken(request) {
      return (
        db.previewToken?.(request) ??
        Promise.resolve(options.previewToken ?? 'dev-preview-token')
      )
    },
    resolve(query) {
      return db.resolve(query)
    },
    user() {
      return Promise.resolve(currentUser)
    },
    enrichUser(user) {
      return Promise.resolve(user)
    },
    listUsers() {
      return Promise.resolve(users)
    },
    createUser(user) {
      const saved = withUserSub(user)
      users = upsertUser(users, saved)
      return Promise.resolve(saved)
    },
    updateUser(user) {
      const saved = withUserSub(user)
      users = upsertUser(users, saved)
      return Promise.resolve(saved)
    },
    removeUser(email) {
      const normalized = email.toLowerCase()
      users = users.filter(user => user.email?.toLowerCase() !== normalized)
      return Promise.resolve()
    },
    write(request) {
      return db.write(request)
    },
    getTreeIfDifferent(sha) {
      return db.getTreeIfDifferent(sha)
    },
    getBlobs(shas) {
      return db.getBlobs(shas)
    },
    revisions(file) {
      return db.revisions?.(file) ?? Promise.resolve([] satisfies Array<Revision>)
    },
    revisionData(file, revisionId) {
      return db.revisionData?.(file, revisionId) ?? Promise.resolve(undefined)
    },
    getDraft(draftKey) {
      return db.getDraft?.(draftKey) ?? Promise.resolve(undefined)
    },
    storeDraft(draft) {
      return db.storeDraft?.(draft) ?? Promise.resolve()
    },
    prepareUpload(file) {
      return db.prepareUpload(file)
    }
  }
}

function withUserSub(user: UserInput): User {
  return {
    ...user,
    sub: user.sub ?? user.email ?? 'user'
  }
}

function upsertUser(users: Array<User>, user: User): Array<User> {
  const email = user.email?.toLowerCase()
  if (!email) return [...users, user]
  const existing = users.findIndex(user => user.email?.toLowerCase() === email)
  if (existing === -1) return [...users, user]
  const next = users.slice()
  next[existing] = user
  return next
}
