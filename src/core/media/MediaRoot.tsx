import {PathField} from 'alinea/input/path'
import {TextField} from 'alinea/input/text'
import IcRoundPermMedia from 'alinea/ui/icons/IcRoundPermMedia'
import {Meta} from '../Meta.js'
import {PageSeed, page} from '../Page.js'
import {Root, root} from '../Root.js'
import {MediaLibrary} from './MediaSchema.js'

type MediaRoot = Root<{
  media: PageSeed<{
    title: TextField
    path: PathField
  }>
}>

export const mediaRoot: MediaRoot = root('Media', {
  media: page(
    MediaLibrary({
      title: 'Media library'
    })
  ),
  [Meta]: {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary']
  }
})
