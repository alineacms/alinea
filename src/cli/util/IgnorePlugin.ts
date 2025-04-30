import type {Plugin} from 'esbuild'

export const ignorePlugin: Plugin = {
  name: 'ignore',
  setup(build) {
    const commonExtensions = [
      'html',
      'scss',
      'less',
      'png',
      'jpg',
      'gif',
      'svg'
    ]
    const filter = new RegExp(
      `(${commonExtensions.map(ext => `\\.${ext}`).join('|')})$`
    )
    build.onLoad({filter}, args => {
      return {contents: 'export default null'}
    })
  }
}
