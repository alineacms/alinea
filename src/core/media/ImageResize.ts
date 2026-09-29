/** Scale down uploaded images that are larger than these dimensions */
export interface ImageResizeOptions {
  /** Maximum width in pixels */
  maxWidth?: number
  /** Maximum height in pixels */
  maxHeight?: number
  /** Encoding quality of jpeg and webp images between 0 and 1, defaults to 0.85 */
  quality?: number
}

export interface ImageResizeTarget {
  width: number
  height: number
  type: string
  quality: number
}

const resizableTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

const defaultQuality = 0.85

/** Uploads are scaled down to fit these dimensions unless configured */
export const defaultImageResize: ImageResizeOptions = {
  maxWidth: 2560,
  maxHeight: 2560
}

/** The resize options of the config, undefined when resizing is disabled */
export function imageResizeOptions(
  option: ImageResizeOptions | false | undefined
): ImageResizeOptions | undefined {
  if (option === false) return undefined
  return option ?? defaultImageResize
}

/** The mime type a raster image is encoded with when it is resized or
 * edited, undefined for vector and animated formats */
export function imageEncodingType(fileName: string): string | undefined {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0]
  return extension ? resizableTypes[extension] : undefined
}

/** Whether uploads of this file are scaled down, vector and animated
 * formats are left as they are. */
export function isResizableImage(fileName: string): boolean {
  return imageEncodingType(fileName) !== undefined
}

/** The dimensions and encoding an image scales down to, undefined when it
 * fits within the options or cannot be resized. */
export function imageResizeTarget(
  fileName: string,
  width: number,
  height: number,
  options: ImageResizeOptions
): ImageResizeTarget | undefined {
  const type = imageEncodingType(fileName)
  if (!type || !width || !height) return undefined
  const scale = Math.min(
    1,
    (options.maxWidth ?? width) / width,
    (options.maxHeight ?? height) / height
  )
  if (scale >= 1) return undefined
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    type,
    quality: options.quality ?? defaultQuality
  }
}
