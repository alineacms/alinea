import type {
  BackendCapabilities,
  LocalConnection,
  Revision,
  Submission
} from '#/core/Connection.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {User, UserInput} from '#/core/User.js'
import {localUser} from '#/core/User.js'

interface TestConnectionOptions {
  capabilities?: BackendCapabilities
  previewToken?: string
  user?: User
  users?: Array<User>
  submissions?: Array<Submission>
}

interface ConnectionOverrides extends Partial<
  Pick<
    LocalConnection,
    'getDraft' | 'previewToken' | 'revisionData' | 'revisions' | 'storeDraft'
  >
> {}

export function createTestConnection(
  db: LocalStore & ConnectionOverrides,
  options: TestConnectionOptions = {}
): LocalConnection {
  const currentUser: User = options.user ?? localUser
  let users = options.users?.slice() ?? [currentUser]
  let submissions = options.submissions?.slice() ?? []
  return {
    submissions(entryId, {offset = 0, limit = 50} = {}) {
      const ofEntry = submissions.filter(
        submission => submission.entryId === entryId
      )
      return Promise.resolve({
        submissions: ofEntry.slice(offset, offset + limit),
        total: ofEntry.length
      })
    },
    updateSubmission(entryId, id, status) {
      submissions = submissions.map(submission =>
        submission.entryId === entryId && submission.id === id
          ? {...submission, status}
          : submission
      )
      return Promise.resolve()
    },
    submissionFile() {
      return Promise.resolve(new Blob(['file']))
    },
    deleteSubmission(entryId, id) {
      submissions = submissions.filter(
        submission => submission.entryId !== entryId || submission.id !== id
      )
      return Promise.resolve()
    },
    capabilities() {
      return Promise.resolve(options.capabilities ?? {users: true})
    },
    mutate(mutations) {
      return db.mutate(mutations)
    },
    previewToken() {
      return (
        db.previewToken?.() ??
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
    getTreeIfDifferent(sha) {
      return db.getTreeIfDifferent(sha)
    },
    getBlobs(shas) {
      return db.getBlobs(shas)
    },
    revisions(file) {
      return (
        db.revisions?.(file) ?? Promise.resolve([] satisfies Array<Revision>)
      )
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
    prepareUpload(file, metadata) {
      return db.prepareUpload(file, metadata)
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
