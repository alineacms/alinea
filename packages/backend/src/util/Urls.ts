export function walkUrl(url: string | undefined): Array<string> {
  const res = []
  while (true) {
    if (url === undefined) return res
    res.unshift(url)
    url = parentUrl(url)
  }
}

export function parentUrl(url: string): string | undefined {
  if (url === '/') return undefined
  const last = url.lastIndexOf('/')
  if (last > -1) return url.substring(0, last) || undefined
  return undefined
}
