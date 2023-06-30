import {MediaExplorer} from 'alinea/dashboard/view/MediaExplorer'
import {PathField} from 'alinea/input/path'
import {TextField} from 'alinea/input/text'
import IcRoundPermMedia from 'alinea/ui/icons/IcRoundPermMedia'
import {Meta} from '../Meta.js'
import {PageSeed} from '../Page.js'
import {Root, root} from '../Root.js'
import {mediaRoot as mediaRootConfig} from './MediaRoot.js'

type MediaRoot = Root<{
  media: PageSeed<{
    title: TextField
    path: PathField
  }>
}>

export const mediaRoot: MediaRoot = root('Media', {
  media: mediaRootConfig.media,
  [Meta]: {
    icon: IcRoundPermMedia,
    contains: ['MediaLibrary'],
    view: MediaExplorer
  }
})
