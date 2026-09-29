import esbuild from 'esbuild'
import {generate} from './Generate.js'

export interface MigrateOptions {
  format: string
  cwd?: string
  configFile?: string
}

export async function migrate(options: MigrateOptions): Promise<void> {
  const {format, cwd, configFile} = options
  for await (const {cms, db} of generate({
    cmd: 'dev',
    cwd,
    configFile,
    watch: false,
    quiet: true
  })) {
    const converted = await db.migrate(`.${format}`)
    console.log(`> Converted ${converted} content files to ${format}`)
    if ((cms.config.contentFormat ?? 'json') !== format)
      console.log(
        `> Set contentFormat: '${format}' in your config to write new entries as ${format}`
      )
    break
  }
  // The config build's esbuild service outlives the process after a large
  // rewrite of the content files unless it is stopped
  await esbuild.stop()
}
