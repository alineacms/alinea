export const imageExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.avif',
  '.heic',
  '.svg'
]

export function isImage(pathOrExtension: string) {
  const extension = pathOrExtension.toLowerCase().split('.').pop()
  return extension && imageExtensions.includes(`.${extension}`)
}
