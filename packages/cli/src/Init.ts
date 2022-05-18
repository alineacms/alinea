import {createId, outcome} from '@alinea/core'
import {detect} from 'detect-package-manager'
import {dirname} from 'dirname-filename-esm'
import fs from 'fs-extra'
import {execSync} from 'node:child_process'
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
    console.log(`> A folder named ".alinea" already exists in ${cwd}`)
    process.exit(1)
  }
  if (fs.existsSync(path.join(cwd, 'alinea.config.tsx'))) {
    console.log(`> An alinea config file already exists in ${cwd}`)
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
  const [pkg, err] = await outcome(
    fs
      .readFile(path.join(cwd, 'package.json'), 'utf-8')
      .then(contents => JSON.parse(contents))
  )
  const pm = await detect({cwd})
  if (pkg) {
    if (!pkg.dependencies) pkg.dependencies = {}
    pkg.dependencies['@alinea/content'] = `${
      pm !== 'npm' ? 'link' : 'file'
    }:./.alinea`
    if (!pkg.scripts) pkg.scripts = {}
    /*
    // Not sure if a postinstall script is right, since it has the potential to 
    // fail during execution
    const currentPostinstall = pkg.scripts.postinstall
    const postinstall = currentPostinstall
      ? `${currentPostinstall} && alinea generate`
      : 'alinea generate'
    pkg.scripts.postinstall = postinstall
    */
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify(pkg, null, 2)
    )
    await fs.mkdir(path.join(cwd, '.alinea'))
    execSync(`${pm} install`, {cwd, stdio: 'inherit'})
  }
  await generate({cwd: path.resolve(cwd), quiet})
  const runner = pm === 'npm' ? 'npx' : pm
  const command = `${runner} alinea serve`
  if (!quiet)
    console.log(
      '> Alinea initialized. You can open the dashboard with `' + command + '`'
    )
}
