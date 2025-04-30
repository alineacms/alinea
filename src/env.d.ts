declare module '*.module.scss' {
  const classes: {[key: string]: string}
  export default classes
}

declare module 'raw-loader!*' {
  const content: string
  export default content
}

declare module 'postcss-pxtorem'

declare module 'octokit-commit-multiple-files/create-or-update-files.js' {
  import type {Octokit} from '@octokit/rest'

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
