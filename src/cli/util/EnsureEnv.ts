import fs from 'node:fs'
import path from 'node:path'

// Source: stripped down version of dotenv

export function ensureEnv(cwd = process.cwd()) {
  const dotEnvFile = path.join(cwd, '.env')
  const LINE =
    /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm
  let src: string
  try {
    src = fs.readFileSync(dotEnvFile, 'utf-8')
  } catch (err) {
    const parent = path.dirname(cwd)
    if (parent === cwd) return
    return ensureEnv(path.dirname(cwd))
  }
  const obj: Record<string, string> = {}

  // Convert buffer to string
  let lines = src.toString()

  // Convert line breaks to same format
  lines = lines.replace(/\r\n?/gm, '\n')

  let match
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1]

    // Default undefined or null to empty string
    let value = match[2] || ''

    // Remove whitespace
    value = value.trim()

    // Check if double quoted
    const maybeQuote = value[0]

    // Remove surrounding quotes
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, '$2')

    // Expand newlines if double quoted
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, '\n')
      value = value.replace(/\\r/g, '\r')
    }

    // Add to object
    obj[key] = value

    const processEnv = process.env

    for (const key of Object.keys(obj)) {
      if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      } else {
        processEnv[key] = obj[key]
      }
    }
  }
}
