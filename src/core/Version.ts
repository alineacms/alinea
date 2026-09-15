import pkg from '../../package.json' with {type: 'json'}

export const alineaVersion = pkg.version as string
export const generatedDatabaseFile = `database-${alineaVersion}.sqlite`

export function versionedCacheName(name: string): string {
  return `${name}-${alineaVersion}`
}
