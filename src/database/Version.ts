/**
 * Bump when the SQLite schema or the data derived into generated databases
 * changes incompatibly. Generated database files and browser caches are keyed
 * by this version rather than the package version, so releases that keep the
 * schema reuse the databases that are already there.
 */
export const databaseVersion = 3

export const generatedDatabaseFile = `database-v${databaseVersion}.sqlite`

export function versionedCacheName(name: string): string {
  return `${name}-v${databaseVersion}`
}
