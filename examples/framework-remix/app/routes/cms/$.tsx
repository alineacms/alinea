import {backend} from '@alinea/generated/backend'
import {remixHandler} from 'alinea/backend/router/RemixHandler'

export const loader = remixHandler(backend.handle)
