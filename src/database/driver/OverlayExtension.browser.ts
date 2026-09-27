/** Browser bundles reach the database driver without ever running it. */
export function overlayExtension(): string {
  throw new Error('The native SQLite extension does not run in browsers')
}
