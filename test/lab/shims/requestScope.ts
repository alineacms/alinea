/** The request an isolate is rendering, read by the `next/headers` shim. */
export interface RenderScope {
  draft: boolean
  cookies: Array<{name: string; value: string}>
}

export const renderScope: RenderScope = {draft: false, cookies: []}
