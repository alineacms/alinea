import {cms} from '@/cms'
import {createHandler} from 'alinea/next'

export const GET = createHandler(cms)
export const POST = createHandler(cms)

export const runtime = 'edge'
