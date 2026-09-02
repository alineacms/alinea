import {cms} from '@/cms'
import {createHandler} from 'alinea/next'

const handler = createHandler({
  cms,
  beforeCommit: hook('beforeCommit'),
  afterCommit: hook('afterCommit')
})

export const GET = handler
export const POST = handler

function hook(name: string) {
  return (input: unknown) => console.log(`Hook triggered: ${name}`, input)
}
