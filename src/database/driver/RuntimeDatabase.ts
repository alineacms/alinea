// Node modules are imported where used: client bundles reach this module
// through the CMS config without running it.
import type {Database, DatabaseOptions} from 'rado'
import type {DatabaseHandle} from './DatabaseHandle.js'
import {openWasmDatabase} from './WasmDatabase.js'

export interface RuntimeDatabaseOptions extends DatabaseOptions {
  path: string
  /** Keep every write in memory: the file is never written. */
  overlay?: boolean
  /**
   * Overlay a copy of the file in memory instead of the file itself, for a
   * file another connection writes: the native overlay locks writers out.
   */
  copy?: boolean
}

/**
 * Open a SQLite file with the native Node/Bun driver. Overlays of the file
 * keep their writes in memory and fork cheaply, through the native overlay
 * VFS or else a WASM copy; a file opened for writing cannot fork.
 */
export async function runtimeDatabase(
  options: RuntimeDatabaseOptions
): Promise<DatabaseHandle> {
  const {path, overlay, copy, ...rest} = options
  if (!overlay)
    return {database: await openNative(path, rest), driver: 'native'}
  if (!copy && (await loadOverlayVfs())) return overlayDatabase(path, rest)
  const {readFile} = await import('node:fs/promises')
  return openWasmDatabase(await readFile(path), rest)
}

async function openNative(
  path: string,
  options: DatabaseOptions
): Promise<Database> {
  if (typeof Bun !== 'undefined') {
    const [{Database: BunDatabase}, {connect}] = await Promise.all([
      import('bun:sqlite'),
      import('rado/driver/bun-sqlite')
    ])
    return connect(new BunDatabase(path, {create: true}), options)
  }
  const [{DatabaseSync}, {connect}] = await Promise.all([
    import('node:sqlite'),
    import('rado/driver/node-sqlite')
  ])
  const client = new DatabaseSync(path)
  return connect(client as Parameters<typeof connect>[0], options)
}

let overlayVfs: Promise<boolean> | undefined

/** Register the process-wide `overlay` VFS of the native SQLite extension. */
function loadOverlayVfs(): Promise<boolean> {
  return (overlayVfs ??= (async () => {
    // Bun's SQLite neither parses file URIs nor loads extensions on macOS.
    if (typeof Bun !== 'undefined') return false
    try {
      const [{DatabaseSync}, {overlayExtension}] = await Promise.all([
        import('node:sqlite'),
        // Imported through the package exports: client bundles that reach
        // this module get a stub instead of the native extension's loader.
        import('#/database/driver/OverlayExtension.js')
      ])
      const loader = new DatabaseSync(':memory:', {allowExtension: true})
      try {
        loader.loadExtension(overlayExtension())
      } finally {
        loader.close()
      }
      return true
    } catch (error) {
      console.warn(
        `Alinea could not load its native SQLite extension and reads the generated database into memory instead: ${error instanceof Error ? error.message : error}`
      )
      return false
    }
  })())
}

/**
 * Open a file through the native overlay VFS. Writers of the file are locked
 * out while any overlay of it is open.
 */
async function overlayDatabase(
  path: string,
  options: DatabaseOptions
): Promise<DatabaseHandle> {
  const [{DatabaseSync}, {connect}, {pathToFileURL}] = await Promise.all([
    import('node:sqlite'),
    import('rado/driver/node-sqlite'),
    import('node:url')
  ])
  const file = pathToFileURL(path).href
  // Overlay names are shared by the whole process, including other copies
  // of this module.
  function open(from?: string): DatabaseHandle {
    const name = `alinea_${crypto.randomUUID()}`
    let uri = `${file}?vfs=overlay&overlay=${name}`
    if (from) uri += `&from=${from}`
    const client = new DatabaseSync(uri)
    // Read the pages this overlay has not changed straight from the
    // memory-mapped file: on a cold volume (a fresh serverless instance) this
    // turns hundreds of small reads per render into a few large ones. The
    // setting is per connection, so every fork sets it again. It is a
    // ceiling, not an allocation: only the file's actual size is mapped.
    client.exec('pragma mmap_size = 268435456')
    return {
      database: connect(client as Parameters<typeof connect>[0], options),
      driver: 'overlay',
      fork: async () => open(name)
    }
  }
  return open()
}
