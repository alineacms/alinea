import {base64} from '#/core/util/Encoding.js'
import {thumbHashToDataURL} from 'thumbhash'

interface HasThumbHash {
  thumbHash?: string
}

export function imageBlurUrl({thumbHash}: HasThumbHash) {
  return thumbHash && thumbHashToDataURL(base64.parse(thumbHash))
}
