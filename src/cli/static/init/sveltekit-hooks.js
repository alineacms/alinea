import {createHandle} from 'alinea/sveltekit'
import {cms} from './cms'

// Serves the Alinea API and dashboard, and lets queries see drafts
export const handle = createHandle(cms)
