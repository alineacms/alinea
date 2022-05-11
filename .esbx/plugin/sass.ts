import {SassPlugin} from '@esbx/sass'
import autoprefixer from 'autoprefixer'
import path from 'path'
import pxToRem from 'postcss-pxtorem'

export const sassPlugin = SassPlugin.configure({
  postCssPlugins: [
    pxToRem({
      propList: ['*'],
      minPixelValue: 2
    }),
    autoprefixer()
  ],
  moduleOptions: {
    localsConvention: 'dashes',
    generateScopedName(name, fileName, css) {
      const module = path.basename(fileName).split('.')[0]
      /*const pkgPath = fileName
        .split('packages')[1]
        .split(path.sep)
        .filter(segment => segment !== 'src')
        .concat([module])*/
      if (name.startsWith('root-')) name = name.slice(5)
      if (name.startsWith('root')) name = name.slice(4)
      return `alinea-${module}${name ? '-' + name : ''}`
    }
  }
})
