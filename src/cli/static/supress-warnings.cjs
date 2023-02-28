// Based on: https://github.com/esbuild-kit/tsx/blob/develop/src/suppress-warnings.cts

const errorMsg =
  'The Node.js specifier resolution flag is experimental. It could change or be removed at any time.'

const {emit} = process

process.emit = function (event, warning) {
  if (event === 'warning' && warning.message.includes(errorMsg)) return
  return emit.apply(process, arguments)
}
