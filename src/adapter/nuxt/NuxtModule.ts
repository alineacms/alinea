import type {PreviewsOptions} from '#/adapter/server/Middleware.js'
import {findConfigFile} from '#/cli/util/FindConfigFile.js'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

export interface AlineaNuxtOptions {
  /** Live previews on draft pages, enabled by default. */
  previews?: PreviewsOptions | false
}

/** The parts of the Nuxt instance the module configures. */
export interface NuxtInstance {
  options: {
    rootDir: string
    buildDir: string
    alinea?: AlineaNuxtOptions
    plugins: Array<string | {src: string; mode?: 'client' | 'server' | 'all'}>
    nitro: {
      plugins?: Array<string>
      virtual?: Record<string, string | (() => string)>
      rollupConfig?: {external?: Array<string | RegExp>}
    }
  }
}

/**
 * Adds Alinea to a Nuxt app, for the `cms` exported from `cms.ts` or
 * `src/cms.ts`: a Nitro plugin serves the handler and dashboard and lets
 * queries see drafts, and a client plugin refreshes the page data on live
 * preview updates.
 */
export default function alinea(
  inlineOptions: AlineaNuxtOptions,
  nuxt: NuxtInstance
): void {
  const {rootDir, buildDir, nitro} = nuxt.options
  const {previews = {}} = {...nuxt.options.alinea, ...inlineOptions}
  const cmsFile = findConfigFile(rootDir)
  if (!cmsFile)
    throw new Error(
      `Alinea could not find cms.ts or src/cms.ts in ${rootDir}, which exports your cms`
    )
  // Nitro resolves plugin paths, so the virtual module has a path too
  const plugin = path.join(buildDir, 'alinea.nitro.mjs')
  nitro.virtual = {...nitro.virtual, [plugin]: pluginSource(cmsFile, previews)}
  nitro.plugins = [...(nitro.plugins ?? []), plugin]
  // Nitro bundles alinea (Nuxt transpiles modules), whose database driver
  // imports the builtin of the runtime it runs on
  const {rollupConfig = {}} = nitro
  nitro.rollupConfig = {
    ...rollupConfig,
    external: [...(rollupConfig.external ?? []), 'node:sqlite', 'bun:sqlite']
  }
  nuxt.options.plugins.push({
    src: fileURLToPath(new URL('./static/refresh.js', import.meta.url)),
    mode: 'client'
  })
}

alinea.getMeta = () => ({name: 'alinea', configKey: 'alinea'})

export function pluginSource(
  cmsFile: string,
  previews: PreviewsOptions | false
): string {
  return [
    `import {cms} from ${JSON.stringify(cmsFile)}`,
    `import {createNitroPlugin} from 'alinea/nuxt'`,
    `export default createNitroPlugin({cms, previews: ${JSON.stringify(previews)}})`
  ].join('\n')
}
