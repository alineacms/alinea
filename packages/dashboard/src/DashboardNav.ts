export const nav = {
  root(workspace: string) {
    return `/${workspace}`
  },
  entry(workspace: string, id?: string) {
    if (!id) return `/${workspace}`
    return `/${workspace}/${id}`
  },
  create(workspace: string, parent: string) {
    return `/${workspace}/${parent}/new`
  }
}
