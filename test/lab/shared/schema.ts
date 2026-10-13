import {Config, Field} from '#/index.js'

/** Hosts of the lab network. */
export const siteOrigin = 'https://site.lab'
export const cloudOrigin = 'https://cloud.lab'
export const githubOrigin = 'https://github.lab'
export const handlerPath = '/api'
export const handlerUrl = `${siteOrigin}${handlerPath}`
/** Cloud api keys start with `alineapk`, the client id follows. */
export const labApiKey = 'alineapk_lab_secret'

export type ConfigVersion = 1 | 2

/**
 * The two configs a deploy can ship: the second adds a field, which changes
 * the config fingerprint and so how every stored database derives entries.
 */
export function labConfig(version: ConfigVersion) {
  // Queries name their types by identity: one config per version
  return (configs[version] ??= createLabConfig(version))
}

const configs: Partial<
  Record<ConfigVersion, ReturnType<typeof createLabConfig>>
> = {}

function createLabConfig(version: ConfigVersion) {
  const fields = {
    title: Field.text('Title'),
    path: Field.path('Path'),
    body: Field.text('Body', {multiline: true}),
    ...(version === 2 ? {summary: Field.text('Summary')} : {})
  }
  const Page = Config.document('Page', {fields})
  return Config.create({
    baseUrl: siteOrigin,
    handlerUrl: handlerPath,
    syncInterval: 60,
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        mediaDir: 'public',
        roots: {
          pages: Config.root('Pages', {contains: ['Page']})
        }
      })
    }
  })
}

export function configFingerprint(version: ConfigVersion): string {
  return `config-v${version}`
}
