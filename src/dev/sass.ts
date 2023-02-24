import {SassPlugin} from '@esbx/sass'
import autoprefixer from 'autoprefixer'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import pxToRem from 'postcss-pxtorem'
import type {FileImporter} from 'sass-embedded'

const prefix = 'alinea/'
const resolveAlinea: FileImporter<'sync'> = {
  findFileUrl(url) {
    if (!url.startsWith(prefix)) return null
    return pathToFileURL('src/' + url.slice(prefix.length))
  }
}

export const sassPlugin = SassPlugin.configure({
  postCssPlugins: [
    pxToRem({
      propList: ['*'],
      minPixelValue: 2
    }),
    autoprefixer()
  ],
  scssOptions: {
    importers: [resolveAlinea]
  },
  moduleOptions: {
    localsConvention: 'dashes',
    generateScopedName(name, fileName, css) {
      const module = path.basename(fileName).split('.')[0]
      if (name.startsWith('root-')) name = name.slice(5)
      if (name.startsWith('root')) name = name.slice(4)
      return `alinea-${module}${name ? '-' + name : ''}`
    }
  }
})
