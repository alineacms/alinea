import {encode} from 'base64-arraybuffer'
import {User} from './User'

export namespace Api {
  export type Context = {user?: User}

  function stripSlash(path?: string): string {
    return path?.startsWith('/') ? path.substring(1) : path || ''
  }
  export const nav = {
    content: {
      get(id: string) {
        return `/content/${stripSlash(id)}`
      },
      list(parent?: string) {
        if (!parent) return '/content.list'
        return `/content.list/${stripSlash(parent)}`
      },
      publish() {
        return `/content.publish`
      }
    },
    drafts: {
      get(id: string, stateVector?: Uint8Array) {
        const route = `/draft/${id}`
        if (stateVector)
          return route + '?stateVector=' + encode(stateVector.buffer)
        return route
      }
    }
  }
}
