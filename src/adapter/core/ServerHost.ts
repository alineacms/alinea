export interface HostCookie {
  name: string
  value: string
}

/** A request as seen by the framework the CMS runs in. */
export interface HostRequest {
  /** Cookies of the request, empty when there are none to read. */
  cookies(): Promise<Array<HostCookie>>
  /** Whether this browser session may see drafts. */
  isDraft(): Promise<boolean>
  /** Allow drafts for this browser session, after a verified preview token. */
  enableDraft(headers: Headers): Promise<void>
}

/** What a framework adapter provides to the shared server CMS and handler. */
export interface ServerHost {
  /**
   * The request being rendered: the same object throughout one request,
   * undefined outside a request (build, scripts).
   */
  current(): HostRequest | undefined
  /** The request the handler is serving. */
  forRequest(request: Request): HostRequest
  /** A production build prerenders from the generated database without syncing. */
  isBuild(): Promise<boolean>
  /** Runtimes without the generated database forward every query to the handler. */
  isEdge(): boolean
  /**
   * Shares the latest content sha between requests. Without it the throttled
   * sync keeps content fresh.
   */
  latestSha?(
    load: () => Promise<string | undefined>
  ): Promise<string | undefined>
  /** Runs after each commit so the shared sha is fetched again. */
  revalidate?(): Promise<void>
}
