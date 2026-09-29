/**
 * The revision of the database the Alinea dev server answers from: it
 * commits every content change to this file, so its modification time and
 * size change with the content. It is read synchronously, which keeps it out
 * of the IO that Next.js tracks while it renders, and is undefined where the
 * file cannot be read, such as in the Edge runtime.
 */
export function developmentRevision(
  file = process.env.ALINEA_GENERATED_DATABASE
): string | undefined {
  if (!file) return undefined
  // Resolved at runtime rather than imported: client bundles reach this
  // module through the CMS config.
  const fs = process.getBuiltinModule?.('node:fs')
  if (!fs) return undefined
  try {
    const {mtimeMs, size} = fs.statSync(file)
    return `${mtimeMs}-${size}`
  } catch {
    return undefined
  }
}

/**
 * Answer a query of a development render through the Next.js data cache,
 * under a key that includes the content revision, so the dev server is asked
 * once per revision. With Cache Components enabled Next.js then treats the
 * answer as cached data, as it does the bundled database in production,
 * instead of as uncached IO that has to be wrapped in `<Suspense>`.
 */
export async function cachedResolve<T>(
  keyParts: Array<string>,
  query: string,
  resolve: () => Promise<T>
): Promise<T> {
  let called = false
  const run = (_query: string) => {
    called = true
    return resolve()
  }
  try {
    const {unstable_cache} = await import('next/cache.js')
    return await unstable_cache(run, ['alinea-resolve', ...keyParts])(query)
  } catch (error) {
    // The query itself failed, do not ask again.
    if (called) throw error
    // Outside the Next.js runtime (tests) there is no data cache.
    return resolve()
  }
}
