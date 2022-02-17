import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {Collection} from '../src/Collection'
import {store} from './DbSuite'

test('IncludeMany', () => {
  const db = store()
  const Role = new Collection<{id: string; name: string}>('Role')
  const role1 = db.insert(Role, {name: 'role1'})
  const role2 = db.insert(Role, {name: 'role2'})
  const User = new Collection<{id: string; roles: Array<string>}>('User')
  const user = db.insert(User, {roles: [role1.id, role2.id]})
  const UserAlias = User.as('user1')
  const RoleAlias = Role.as('role')
  const bundled = db.first(
    UserAlias.select(
      UserAlias.with({
        roles: RoleAlias.where(RoleAlias.id.isIn(UserAlias.roles))
          .select({
            name: RoleAlias.name
          })
          .orderBy(RoleAlias.name.asc())
      })
    )
  )!
  assert.equal([{name: 'role1'}, {name: 'role2'}], bundled.roles)
  const Entry = new Collection<{id: string}>('Entry')
  const Language = new Collection<{id: string; entry: string}>('Language')
  const Version = new Collection<{id: string; language: string}>('Version')
  const entry = db.insert(Entry, {})
  const language = db.insert(Language, {entry: entry.id})
  const version1 = db.insert(Version, {
    language: language.id
  })
  const version2 = db.insert(Version, {
    language: language.id
  })
  const page = db.first(
    Entry.select(
      Entry.with({
        languages: Language.where(Language.entry.is(Entry.id)).select(
          Language.with({
            versions: Version.where(Version.language.is(Language.id))
          })
        )
      })
    )
  )
  assert.equal(
    {
      ...entry,
      languages: [{...language, versions: [version1, version2]}]
    },
    page
  )
})

test('Subquery', () => {
  const db = store()
  const User = new Collection<{id: string; name: string}>('user')
  const Post = new Collection<{id: string; title: string; user: string}>('post')
  const user1 = db.insert(User, {name: 'bob'})
  const post1 = db.insert(Post, {title: 'hello', user: user1.id})
  const userWithPosts = db.first(
    User.where(User.id.is(user1.id)).select(
      User.with({
        posts: Post.where(Post.user.is(User.id)).select({
          id: Post.id
        })
      })
    )
  )!
  assert.is(userWithPosts.name, 'bob')
  assert.is(userWithPosts.posts[0].id, post1.id)
})

test.run()
