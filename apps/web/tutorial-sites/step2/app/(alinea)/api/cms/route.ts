import {cms} from '@/cms'
import {createHandler} from 'alinea/next'

// This handler will respond to API request of the dashboard
const handler = createHandler({cms})

export const GET = handler
export const POST = handler
