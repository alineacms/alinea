/** Docs pages render their own compact footer and sticky chrome */
export function isDocsPath(pathname: string) {
  return pathname === '/docs' || pathname.startsWith('/docs/')
}
