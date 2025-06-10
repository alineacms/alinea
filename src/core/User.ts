export interface User {
  sub: string
  roles: Array<string>
  email?: string
  name?: string
}

export const localUser = {
  sub: 'local',
  name: 'Local user',
  roles: ['admin']
}
