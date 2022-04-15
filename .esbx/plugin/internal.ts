import {AliasPlugin} from '@esbx/alias'
import {getManifest, getWorkspaces} from '@esbx/workspaces'
import type {Plugin} from 'esbuild'
import fs from 'fs-extra'
import path from 'path'

export const internalPlugin: Plugin = {
  name: 'internal',
  setup(build) {
    // These should be resolved using the conditional exports, but before
    // building those are not available so we point at the source directly.
    const packages = fs.readdirSync('packages/input')
    const aliases = Object.fromEntries(
      packages.map(pkg => {
        return [
          `@alinea/input.${pkg}`,
          path.resolve(`packages/input/${pkg}/src/view.ts`)
        ]
      })
    )

    AliasPlugin.configure(aliases).setup(build)

    const paths = Object.fromEntries(
      getWorkspaces(process.cwd()).map(location => {
        const meta = getManifest(location)
        return [meta.name, location]
      })
    )
    build.onResolve({filter: /@alinea\/.*/}, async args => {
      const segments = args.path.split('/')
      const pkg = segments.slice(0, 2).join('/')
      const location = paths[pkg]
      if (!location) return
      const loc = ['.', location, 'src', ...segments.slice(2)].join('/')
      return await build.resolve(loc, {resolveDir: process.cwd()})
    })
  }
}
