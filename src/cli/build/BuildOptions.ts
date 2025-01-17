import {BuildOptions} from 'esbuild'

export const buildOptions: BuildOptions = {
  jsx: 'automatic',
  loader: {
    // CSS
    '.module.css': 'local-css',
    '.css': 'css',

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
