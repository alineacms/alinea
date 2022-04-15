import {SassPlugin} from '@esbx/sass'
import autoprefixer from 'autoprefixer'
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
    generateScopedName: 'alinea__[name]-[local]'
  }
})
