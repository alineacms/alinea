import {createMiddleware} from 'alinea/astro'
import {cms} from './cms'

// Serves the dashboard and the Alinea API, and lets pages query drafts
export const onRequest = createMiddleware(cms)
