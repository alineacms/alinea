declare module '*?alinea' {
  import type {CMS} from '#/core/CMS.js'
  import type {LocalDB} from '#/core/db/LocalDB.js'

  export const cms: CMS
  export const db: LocalDB
}
