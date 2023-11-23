import {base64} from 'alinea/core/util/Encoding'
import {thumbHashToDataURL} from 'thumbhash'

interface HasThumbHash {
  thumbHash?: string
}

export function imageBlurUrl({thumbHash}: HasThumbHash) {
  return thumbHash && thumbHashToDataURL(base64.parse(thumbHash))
}
