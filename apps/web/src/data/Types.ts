export * from './types-data'

export function memberPath(name: string) {
  return name
    .split('/')
    .filter(segment => segment !== 'dist')
    .join('/')
}

export function packageName(path: string) {
  return path === 'alinea' ? 'alinea' : `@alinea/${path.split('/').join('.')}`
}
