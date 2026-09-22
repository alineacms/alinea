import {withAlinea} from 'alinea/next'

export default withAlinea({
  // The monorepo is on the TypeScript 7 native preview, which does not expose
  // the compiler API Next uses to type check builds. Types are checked with
  // `tsc --noEmit` instead.
  typescript: {ignoreBuildErrors: true}
})
