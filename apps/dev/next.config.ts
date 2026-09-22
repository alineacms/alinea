import {withAlinea} from 'alinea/next'

export default withAlinea({
  // The monorepo is on TypeScript 7, whose package has no compiler API. Next
  // still needs one to write tsconfig defaults, so the app depends on
  // TypeScript 6 itself, but its type check is skipped: types are checked
  // with `tsc --noEmit` from the root.
  typescript: {ignoreBuildErrors: true}
})
