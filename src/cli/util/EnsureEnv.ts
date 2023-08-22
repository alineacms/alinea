import dotenv from 'dotenv'
import findConfig from 'find-config'

export function ensureEnv(cwd = process.cwd()) {
  const path = findConfig('.env', {cwd})
  if (path) dotenv.config({path})
}
