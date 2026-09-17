export type Nav = Array<NavItem>

export type NavItem = {
  id: string
  type?: string
  url?: string
  title?: string
  label?: string
  parent?: string | null
  children?: Array<NavItem>
}

export function nestNav(pages: Nav) {
  const res: Array<NavItem> = pages.filter(page => page.children)
  const root = new Map<string, NavItem>(
    pages
      .filter(page => !page.children)
      .map(page => [page.id, {...page, children: []}])
  )
  for (const page of root.values()) {
    if (!root.has(page.parent!)) {
      res.push(root.get(page.id)!)
    } else {
      root.get(page.parent!)!.children!.push(root.get(page.id)!)
    }
  }
  return res
}
