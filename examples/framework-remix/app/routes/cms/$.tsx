import {remixHandler} from '@alinea/backend/router/RemixHandler'
import {backend} from '@alinea/content/backend'

export const loader = remixHandler(backend.handle)
