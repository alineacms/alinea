import {cms} from '@/cms'
import {Query} from 'alinea'
import {Home} from './schema/Home'

console.log(cms)

async function seed() {
  console.log(await cms.get(Query(Home)))
}

seed().catch(console.error)
