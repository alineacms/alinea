import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {createId} from '#/core/Id.js'
import {Permission} from '#/core/Role.js'
import {atom} from 'jotai'
import {uploadProgressAtom} from './activity.js'
import {configAtom, graphAtom} from './core.js'
import {uploadSizeError} from './utils.js'
import {policyAtom} from './user.js'

export interface UploadFilesRequest {
  files: Iterable<File> | ArrayLike<File>
  workspace: string
  root: string
  parentId?: string
}

export const uploadFilesAtom = atom(
  null,
  async (get, set, request: UploadFilesRequest) => {
    const files = Array.from(request.files)
    if (files.length === 0) return
    const config = get(configAtom)
    const graph = get(graphAtom)
    get(policyAtom).assert(Permission.Upload, {
      workspace: request.workspace,
      root: request.root,
      id: request.parentId
    })
    const destination = {
      workspace: request.workspace,
      root: request.root,
      parentId: request.parentId
    }
    const invalidUploads = files.flatMap(file => {
      const error = uploadSizeError(file, config.maxUploadSize)
      return error ? [{id: createId(), file, error}] : []
    })
    if (invalidUploads.length > 0)
      set(uploadProgressAtom, {
        type: 'fail',
        uploads: invalidUploads,
        destination
      })
    const failedFiles = new Set(invalidUploads.map(upload => upload.file))
    const validFiles = files.filter(file => !failedFiles.has(file))
    const uploads = validFiles.map(file => ({id: createId(), file}))
    if (uploads.length === 0) return
    set(uploadProgressAtom, {type: 'start', uploads, destination})
    await Promise.all(
      uploads.map(async ({id, file}) => {
        try {
          await graph.upload({
            file,
            createPreview,
            parentId: request.parentId,
            workspace: request.workspace,
            root: request.root,
            onProgress: progress =>
              set(uploadProgressAtom, {
                type: 'progress',
                id,
                progress
              })
          })
          set(uploadProgressAtom, {type: 'finish', ids: [id]})
        } catch (error) {
          set(uploadProgressAtom, {
            type: 'fail',
            uploads: [
              {
                id,
                file,
                error: error instanceof Error ? error.message : String(error)
              }
            ],
            destination
          })
        }
      })
    )
  }
)
