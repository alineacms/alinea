import {bundle} from 'dts-bundle'
import fs from 'fs-extra'
import path from 'path'

export const bundleTs = {
  async action() {
    const root = './dist'
    const pkgs = await fs.readdir(root)
    for (const pkg of pkgs) {
      if (!fs.existsSync(path.join(root, `${pkg}/src/index.d.ts`))) continue
      bundle({
        name: pkg === 'alinea' ? 'alinea' : `@alinea/${pkg}`,
        main: path.join(root, `${pkg}/src/index.d.ts`),
        out: `../../bundle/${pkg}.d.ts`
      })
    }
    const bundleRoot = './dist/bundle'
    const dts = await fs.readdir(bundleRoot)
    const contents: Array<Buffer> = []
    for (const file of dts) {
      const content = await fs.readFile(path.join(bundleRoot, file))
      contents.push(content)
    }
    await fs.writeFile('./dist/alinea.d.ts', Buffer.concat(contents))
  }
}
