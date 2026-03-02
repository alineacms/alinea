declare module '*?alinea' {
  import type {CMS} from 'alinea/core/CMS'
  import type {LocalDB} from 'alinea/core/db/LocalDB'

  export const cms: CMS
  export const db: LocalDB
}
