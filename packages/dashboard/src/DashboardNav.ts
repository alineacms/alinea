export const nav = {
  root(workspace: string, root: string) {
    return `/${workspace}/${root}`
  },
  entry(workspace: string, root?: string, id?: string) {
    if (!id && !root) return `/${workspace}`
    if (!id) return `/${workspace}/${root}`
    return `/${workspace}/${root}/${id}`
  },
  create(workspace: string, root: string, parent: string) {
    return `/${workspace}/${root}/${parent}/new`
  }
}
