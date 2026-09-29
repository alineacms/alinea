/**
 * Tests a file against accepted mime types (`image/png`, `image/*`) or file
 * extensions (`.pdf`), every file is accepted if left out
 */
export function acceptsFile(accept: Array<string> | undefined, file: File) {
  if (!accept || accept.length === 0) return true
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()
  return accept.some(pattern => {
    const type = pattern.trim().toLowerCase()
    if (type.startsWith('.')) return name.endsWith(type)
    if (type.endsWith('/*')) return mime.startsWith(type.slice(0, -1))
    return mime === type
  })
}
