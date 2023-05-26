import {Entry} from 'alinea/core'

const MAX_COOKIE_LENGTH = 4096

// Stringifies, then packs the string into multiple cookies with
// incremental names that do not exceed 4096 bytes (this limit applies to the
// full cookie including its name). The value is url encoded.
export function formatPreviewCookies(cookieName: string, entry: Entry) {
  const json = JSON.stringify(entry)
  const encoded = encodeURIComponent(json)
  let res = [],
    batch = -1,
    position = 0
  while (true) {
    batch++
    const prefix = `${cookieName}-${batch}=`
    const amount = MAX_COOKIE_LENGTH - prefix.length
    const value = encoded.substring(position, position + amount)
    res.push(`${prefix}${value}`)
    position += amount
    if (position >= encoded.length) break
  }
  return [`${cookieName}=${batch + 1}`, ...res]
}

export function parsePreviewCookies(
  cookieName: string,
  allCookies: Array<{name: string; value: string}>
) {
  const amount = allCookies.find(({name}) => name === cookieName)
  if (!amount) return undefined
  const count = Number(amount.value)

  console.log('===============================')
  console.log({count, amount})

  console.log('===============================')

  const parts = allCookies
    .filter(({name}) => name.startsWith(cookieName))
    .sort((a, b) => {
      return a.name.localeCompare(b.name)
    })

  console.log({parts})
  const slices = parts.slice(1, 1 + count).map(({value}) => value)
  console.log({
    parts: slices.length,
    count
  })
  if (slices.length !== count) return undefined
  const encoded = slices.join('')
  const json = decodeURIComponent(encoded)
  console.log({json})
  try {
    return JSON.parse(json) as Entry
  } catch {
    return undefined
  }
}
