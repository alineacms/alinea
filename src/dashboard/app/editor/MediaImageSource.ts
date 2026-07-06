import {Config} from '#/core/Config.js'

export function mediaLiveUrl(config: Config, location: string | undefined) {
  if (!location) return
  try {
    return String(
      new URL(location, Config.baseUrl(config) ?? window.location.href)
    )
  } catch {
    return
  }
}

export function loadPreferredImageSource(
  preferred: string | undefined,
  fallback: string
): Promise<string> {
  if (!preferred) return Promise.resolve(fallback)
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      resolve(preferred)
      image.onload = null
      image.onerror = null
    }
    image.onerror = () => {
      resolve(fallback)
      image.onload = null
      image.onerror = null
    }
    image.src = preferred
  })
}
