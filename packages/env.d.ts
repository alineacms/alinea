declare module '.alinea'

declare module '*.module.scss' {
  const classes: {[key: string]: string}
  export default classes
}

declare module 'get-random-values'
declare module 'leb128'

declare module 'simple-slugify' {
  export type SlugifyOptions = {
    lowercase?: boolean
    normalize?: string
    replacement?: string
    reserved?: boolean
    unsafe?: boolean
    trim?: boolean
    spaceLess?: boolean
    space?: boolean
  }
  export function slugify(str: string, options?: SlugifyOptions): string
}

declare module 'octokit-commit-multiple-files/create-or-update-files.js' {
  import {Octokit} from '@octokit/rest'

  const createOrUpdateFiles: (
    octokit: Octokit,
    params: {
      owner: string
      repo: string
      branch: string
      // path: string
      committer?: {name: string; email: string}
      author?: {name: string; email: string}
      createBranch?: boolean
      changes: Array<{
        message: string
        files: {
          [file: string]:
            | string
            | {contents: string; mode: string; type: string}
        }
        filesToDelete?: Array<string>
        ignoreDeletionFailures?: boolean
      }>
    }
  ) => Promise<void>
  export default createOrUpdateFiles
}
