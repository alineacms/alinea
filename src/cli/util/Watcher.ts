import esbuild, {Plugin} from 'esbuild'

interface ToWatch {
  dirs: Array<string>
  files: Array<string>
}

// Re-use the esbuild watch service which is not exposed to the api
export async function createWatcher(watch: ToWatch, onChange: () => void) {
  const watcher: Plugin = {
    name: 'watcher',
    setup(build) {
      build.onResolve({filter: /^watch$/}, args => {
        return {external: true, watchFiles: watch.files, watchDirs: watch.dirs}
      })
      build.onStart(onChange)
    }
  }
  const context = await esbuild.context({
    bundle: true,
    stdin: {contents: "import 'watch'"},
    plugins: [watcher],
    write: false
  })
  context.watch()
  return context.dispose
}
