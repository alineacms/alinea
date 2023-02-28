import fs from 'fs-extra'
import path from 'node:path'
import {GenerateContext} from './GenerateContext.js'

export async function copyBoilerplate({staticDir, outDir}: GenerateContext) {
  await fs.copy(path.join(staticDir, 'server'), path.join(outDir, '.server'), {
    overwrite: true
  })
}
