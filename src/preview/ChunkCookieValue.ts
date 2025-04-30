type Cookie = {name: string; value: string}

export const MAX_COOKIE_LENGTH = 4096

// Provided value should be url encoded
export function chunkCookieValue(
  cookieName: string,
  cookieValue: string,
  maxLength = MAX_COOKIE_LENGTH
): Array<Cookie> {
  const res: Array<Cookie> = []
  let position = 0
  let batch = 0
  while (position < cookieValue.length) {
    const name = `${cookieName}-${batch}`
    const amount = maxLength - name.length
    if (amount <= 0) throw new Error('Max length is not sufficient')
    const value = cookieValue.substring(position, position + amount)
    position += amount
    batch++
    res.push({name, value})
  }
  res.unshift({name: cookieName, value: String(batch)})
  return res
}

export function parseChunkedCookies(
  cookieName: string,
  allCookies: Array<Cookie>
): string | undefined {
  const amount = allCookies.find(({name}) => name === cookieName)
  if (!amount) return undefined
  const count = Number(amount.value)
  const parts = allCookies
    .filter(({name}) => name.startsWith(`${cookieName}-`))
    .sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
  const slices = parts.slice(0, count).map(({value}) => value)
  if (slices.length !== count) return undefined
  return slices.join('')
}
