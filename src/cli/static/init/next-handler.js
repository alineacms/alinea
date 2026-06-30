import {createHandler} from '#/next.js'
import {cms} from '@/cms'

// This handler will respond to API request of the dashboard
const handler = createHandler({cms})

export const GET = handler
export const POST = handler
