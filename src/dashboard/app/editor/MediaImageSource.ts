import {Config} from '#/core/Config.js'

export function mediaLiveUrl(config: Config, publicUrl: string | undefined) {
  if (!publicUrl) return
  try {
    return String(
      new URL(publicUrl, Config.baseUrl(config) ?? window.location.href)
    )
  } catch {
    return
  }
}
