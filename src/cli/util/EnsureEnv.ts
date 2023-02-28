import dotenv from 'dotenv'
import findConfig from 'find-config'

export function ensureEnv(cwd: string) {
  const path = findConfig('.env', {cwd})
  if (path) dotenv.config({path})
}
