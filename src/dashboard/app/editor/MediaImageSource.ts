import {Config} from '#/core/Config.js'
import {mediaLocationUrl} from '#/core/util/EntryFilenames.js'

export function mediaLiveUrl(
  config: Config,
  workspace: string,
  location: string | undefined
) {
  if (!location) return
  try {
    return String(
      new URL(
        mediaLocationUrl(config, workspace, location),
        Config.baseUrl(config) ?? window.location.href
      )
    )
  } catch {
    return
  }
}
