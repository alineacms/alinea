import {dirname} from 'dirname-filename-esm'
import fs from 'fs-extra'
import path from 'node:path'
import {generate} from './Generate'

const __dirname = dirname(import.meta)

export type InitOptions = {
  cwd?: string
}

export async function init(options: InitOptions) {
  const {cwd = process.cwd()} = options
  if (fs.existsSync(path.join(cwd, '.alinea'))) {
    console.log(`A .alinea folder already exists in ${cwd}`)
    process.exit(1)
  }
  if (fs.existsSync(path.join(cwd, 'alinea.config.tsx'))) {
    console.log(`An alinea config file already exists in ${cwd}`)
    process.exit(1)
  }
  await fs.copy(
    path.join(__dirname, 'static/init/content'),
    path.join(cwd, 'content')
  )
  await fs.copyFile(
    path.join(__dirname, 'static/init/alinea.config.js'),
    path.join(cwd, 'alinea.config.tsx')
  )
  await generate({cwd: path.resolve(cwd)})
  console.log(
    '> Alinea initialized. You can open the dashboard with `npx alinea serve`'
  )
}
