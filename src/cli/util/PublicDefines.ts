const publicEnvKeys = ['NEXT_PUBLIC_', 'PUBLIC_', 'VITE_', 'GATSBY_']

export function publicDefines(environment: typeof process.env) {
  return Object.fromEntries(
    Object.entries(environment)
      .filter(([key, value]) => {
        for (const prefix of publicEnvKeys)
          if (key.startsWith(prefix)) return true
        return false
      })
      .map(([key, value]) => {
        return [`process.env.${key}`, JSON.stringify(value)]
      })
  )
}
