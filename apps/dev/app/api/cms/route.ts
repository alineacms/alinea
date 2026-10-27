import {cms} from '@/cms'
import {createHandler} from 'alinea/next'
import {DatabaseSync} from 'node:sqlite'

const handler = createHandler({
  cms,
  beforeCommit: hook('beforeCommit'),
  afterCommit: hook('afterCommit'),
  forms: {
    // Submissions of forms are kept in a SQLite file next to this app
    database: {
      driver: 'node:sqlite',
      client: new DatabaseSync('.forms.sqlite')
    },
    mailer: hook('forms.mailer'),
    onSubmit: hook('forms.onSubmit')
  }
})

export const GET = handler
export const POST = handler
// Files visitors add to forms are uploaded with a PUT
export const PUT = handler

function hook(name: string) {
  return (input: unknown) => console.log(`Hook triggered: ${name}`, input)
}
