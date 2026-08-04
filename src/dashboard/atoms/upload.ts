import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {Permission} from '#/core/Role.js'
import type {Policy} from '#/core/Role.js'
import {atom} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import {dispense} from './utils.js'

export interface UploadFilesRequest {
  files: Iterable<File> | ArrayLike<File>
  workspace: string
  root: string
  parentId?: string
}

export const uploadFilesAtom = dispense((policy: Policy) =>
  atom(null, async (get, _set, request: UploadFilesRequest) => {
    const files = Array.from(request.files)
    if (files.length === 0) return
    const config = get(configAtom)
    const graph = get(graphAtom)
    policy.assert(Permission.Upload, {
      workspace: request.workspace,
      root: request.root,
      id: request.parentId
    })
    for (const file of files)
      assertUploadSize(file.name, file.size, config.maxUploadSize)
    await Promise.all(
      files.map(file =>
        graph.upload({
          file,
          createPreview,
          parentId: request.parentId,
          workspace: request.workspace,
          root: request.root
        })
      )
    )
  })
)
