declare module '*.module.scss' {
  const classes: {[key: string]: string}
  export default classes
}

declare module 'eval:*'
declare module 'postcss-pxtorem'
// @types/react-helmet depends on react < 18 types which breaks things
declare module 'react-helmet'

declare module 'image-blob-reduce' {
  type Options = {
    max: number
    unsharpAmount?: number
    unsharpRadius?: number
    unsharpThreshold?: number
  }
  const reduce: () => {
    toBlob: (blob: Blob, options: Options) => Promise<Blob>
  }
  export default reduce
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
            | ArrayBuffer
            | {contents: string; mode: string; type: string}
        }
        filesToDelete?: Array<string>
        ignoreDeletionFailures?: boolean
      }>
    }
  ) => Promise<void>
  export default createOrUpdateFiles
}
