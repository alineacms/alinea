declare module '*?alinea' {
  import type {CMS} from '#/core/CMS.js'
  import type {LocalConnection} from '#/core/Connection.js'
  import type {SourceDB} from '#/database/entry/SourceDB.js'

  export const cms: CMS
  export const db: SourceDB & LocalConnection
}
