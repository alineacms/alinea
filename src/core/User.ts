export interface User {
  sub: string
  email?: string
  name?: string
}

export const localUser = {
  sub: 'local',
  name: 'Local user'
}
