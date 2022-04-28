import {Pages as AlineaPages} from '@alinea/backend'
import {AnyPage} from './schema.js'
export * from './schema.js'
export * from './types.js'
export type Pages = AlineaPages<AnyPage>
