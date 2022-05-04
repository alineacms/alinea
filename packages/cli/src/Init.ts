import {createId} from '@alinea/core'
import {dirname} from 'dirname-filename-esm'
import fs from 'fs-extra'
import path from 'node:path'
import {generate} from './Generate'

const __dirname = dirname(import.meta)

export type InitOptions = {
  cwd?: string
  quiet?: boolean
}

export async function init(options: InitOptions) {
  const {cwd = process.cwd(), quiet = false} = options
  if (fs.existsSync(path.join(cwd, '.alinea'))) {
    console.log(`A folder named ".alinea" already exists in ${cwd}`)
    process.exit(1)
  }
  if (fs.existsSync(path.join(cwd, 'alinea.config.tsx'))) {
    console.log(`An alinea config file already exists in ${cwd}`)
    process.exit(1)
  }
  await fs.mkdir(path.join(cwd, 'content/data'), {recursive: true})
  await fs.writeFile(
    path.join(cwd, 'content/data/index.json'),
    JSON.stringify({
      id: createId(),
      type: 'Page',
      root: 'data',
      title: 'Welcome'
    })
  )
  await fs.mkdir(path.join(cwd, 'content/media'), {recursive: true})
  await fs.writeFile(
    path.join(cwd, 'content/media/media.json'),
    JSON.stringify({
      id: createId(),
      type: 'MediaLibrary',
      root: 'media',
      title: 'Media library'
    })
  )
  await fs.copyFile(
    path.join(__dirname, 'static/init/alinea.config.js'),
    path.join(cwd, 'alinea.config.tsx')
  )
  await generate({cwd: path.resolve(cwd), quiet})
  if (!quiet)
    console.log(
      '> Alinea initialized. You can open the dashboard with `npx alinea serve`'
    )
}
