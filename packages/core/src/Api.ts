export namespace Api {
  function stripSlash(path: string) {
    return path.startsWith('/') ? path.substring(1) : path
  }
  export const nav = {
    content: {
      get(path: string) {
        return `/content/${stripSlash(path)}`
      },
      list(parent?: string) {
        return `/content.list/${stripSlash(parent || '')}`
      }
    }
  }
}
