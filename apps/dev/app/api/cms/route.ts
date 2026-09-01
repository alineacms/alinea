import {cms} from '@/cms'
import {createHandler} from 'alinea/next'

const handler = createHandler({
  cms,
  beforeCreate: hook('beforeCreate'),
  afterCreate: hook('afterCreate'),
  beforeUpdate: hook('beforeUpdate'),
  afterUpdate: hook('afterUpdate'),
  beforeArchive: hook('beforeArchive'),
  afterArchive: hook('afterArchive'),
  beforeRemove: hook('beforeRemove'),
  afterRemove: hook('afterRemove')
})

export const GET = handler
export const POST = handler

function hook(name: string) {
  return (input: unknown) => console.log(`Hook triggered: ${name}`, input)
}
