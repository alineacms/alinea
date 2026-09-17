import type {Config} from '#/core/Config.js'
import {wasmDatabase} from '#/database/driver/WasmDatabase.js'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined')
    return new Uint8Array(Buffer.from(base64, 'base64'))
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Open the bundled SQLite file in Edge through sqlite-wasm. */
export async function generatedDatabase(config: Config) {
  // @ts-ignore - generated at build time by the Alinea CLI
  const {database} = await import('@alinea/generated/database.js').catch(
    () => ({database: undefined})
  )
  if (typeof database !== 'string' || !database.length)
    throw new Error(
      'The generated Edge database is missing. Run `alinea generate --build` ' +
        'to bundle database.js, or serve this route from the Node runtime.'
    )
  const db = await wasmDatabase(base64ToBytes(database))
  return createGeneratedDatabase(config, db)
}
