import esbuild, {type Plugin} from 'esbuild'

interface ToWatch {
  dirs: Array<string>
  files: Array<string>
}

export interface WatchOptions {
  watchFiles(): Promise<ToWatch>
  onChange(): void
}

// Re-use the esbuild watch service which is not exposed to the api
export async function createWatcher(
  options: WatchOptions
): Promise<() => void> {
  let initial = true
  const watcher: Plugin = {
    name: 'watcher',
    setup(build) {
      build.onResolve({filter: /^watch$/}, async args => {
        const {files, dirs} = await options.watchFiles()
        return {external: true, watchFiles: files, watchDirs: dirs}
      })
      build.onStart(() => {
        if (initial) initial = false
        else options.onChange()
      })
    }
  }
  const context = await esbuild.context({
    bundle: true,
    stdin: {contents: "import 'watch'"},
    plugins: [watcher],
    write: false
  })
  context.watch()
  return context.dispose.bind(context)
}
