import {backend} from '@alinea/content/backend'
import {remixHandler} from 'alinea/backend/router/RemixHandler'

export const loader = remixHandler(backend.handle)
