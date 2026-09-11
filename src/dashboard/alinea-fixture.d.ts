declare module '*?alinea' {
  import type {CMS} from '#/core/CMS.js'
  import type {LocalConnection} from '#/core/Connection.js'
  import type {EntryStore} from '#/database/EntryStore.js'

  export const cms: CMS
  export const db: EntryStore & LocalConnection & {events: EventTarget}
}
