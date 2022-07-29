import {EvalPlugin} from '@esbx/eval'
import {BuildOptions} from 'esbuild'

export const buildOptions: BuildOptions = {
  plugins: [EvalPlugin],
  jsx: 'automatic',
  loader: {
    // Images
    '.png': 'file',
    '.svg': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.gif': 'file',
    '.webp': 'file',
    '.avif': 'file',
    '.ico': 'file',
    '.bmp': 'file',

    // Fonts
    '.ttf': 'file',
    '.otf': 'file',
    '.eot': 'file',
    '.woff': 'file',
    '.woff2': 'file'
  }
}
