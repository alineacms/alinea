'use server'

import {log} from 'console'

export async function handleRjsfSubmit(state: {}, formData: FormData) {
  const record = formatDataToObject(formData)

  console.log(record)

  return {}
}

function formatDataToObject(formData: FormData) {
  const obj: Record<string, any> = {}

  for (const [rawKey, value] of formData.entries()) {
    // Skip Next.js internal action keys
    if (rawKey.startsWith('$ACTION_')) continue

    // Strip the RJSF "root_" prefix if present
    const key = rawKey.startsWith('root_') ? rawKey.slice(5) : rawKey

    // Split by dots for nested paths (if any)
    const parts = key.split('.')
    let current = obj

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (isLast) {
        // Handle multiple same keys → arrays
        if (current[part] !== undefined) {
          current[part] = Array.isArray(current[part])
            ? [...current[part], value]
            : [current[part], value]
        } else {
          current[part] = value
        }
      } else {
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {}
        }
        current = current[part]
      }
    }
  }

  return obj
}
