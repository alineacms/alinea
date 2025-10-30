//import {db} from '@vercel/postgres'
import {createHandler} from 'alinea/next'
import {cms} from '@/cms'

const handler = createHandler({cms})

export const GET = handler
export const POST = handler
