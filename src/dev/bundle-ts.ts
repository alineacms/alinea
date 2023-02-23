import {bundle} from 'dts-bundle'
import fs from 'fs-extra'
import path from 'node:path'

export const bundleTs = {
  async action() {
    const root = './dist'
    const bundleRoot = './node_modules/.cache/bundle'
    await fs.mkdirp(bundleRoot)
    const pkgs = await fs.readdir(root)
    for (const pkg of pkgs) {
      if (!fs.existsSync(path.join(root, `${pkg}/src/index.d.ts`))) continue
      bundle({
        name: pkg === 'alinea' ? 'alinea' : `@alinea/${pkg}`,
        main: path.join(root, `${pkg}/src/index.d.ts`),
        out: path.resolve(path.join(bundleRoot, `${pkg}.d.ts`))
      })
    }
    const dts = await fs.readdir(bundleRoot)
    const contents: Array<Buffer> = []
    for (const file of dts) {
      const content = await fs.readFile(path.join(bundleRoot, file))
      contents.push(content)
    }
    await fs.writeFile(
      './apps/web/src/data/alinea.d.ts.txt',
      Buffer.concat(contents)
    )
  }
}
