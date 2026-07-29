import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Config} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import {MediaLibrary} from '#/core/media/MediaTypes.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {atom} from 'jotai'
import {debounce, dispense} from './AtomUtils.js'
import {clientAtom, configAtom, previewTokenRequestsAtom} from './CoreAtoms.js'
import type {EntryDataAtoms} from './EntryAtoms.js'
import {
  previewSessionOriginsAtom,
  requestPreviewSessionToken
} from './PreviewAtoms.js'
import {shaAtom} from './SyncAtoms.js'

const decoder = new TextDecoder()

export function createEntryPreviewAtoms(entry: EntryDataAtoms) {
  const preview = atom(get => {
    const type = get(entry.type).type
    if (type === MediaLibrary) return undefined
    const typePreview = Type.preview(type)
    if (typePreview !== undefined) return typePreview
    const config = get(configAtom)
    const workspace = config.workspaces[get(entry.workspaceKey)]
    if (!workspace) return config.preview
    const root = workspace[get(entry.rootKey)]
    return (
      (root ? getRoot(root).preview : undefined) ??
      getWorkspace(workspace).preview ??
      config.preview
    )
  })
  const hasPreview = atom(get => Boolean(get(preview)))
  const previewRetry = atom(0)
  const retryPreviewUrl = atom(null, (_get, set) => {
    set(previewRetry, current => current + 1)
  })
  const previewEntryFor = dispense((locale: string | null) =>
    atom(async get => {
      if (!get(hasPreview)) return null
      const sourceLocale = entry.sourceLocaleFor(get, locale)
      const language = entry.languages(sourceLocale)
      const activeVersion = await get(language.activeVersionResource)
      const node = await get(entry.selectedNodeFor(locale))
      const value = get(node.value)
      if (!isRecord(value)) return activeVersion
      const title =
        typeof value.title === 'string' ? value.title : activeVersion.title
      const path =
        typeof value.path === 'string' ? value.path : activeVersion.path
      return {...activeVersion, title, path, data: value}
    })
  )
  const previewPayloadSource = atom(get => {
    if (get(preview) !== true) return undefined
    const selected = get(entry.selectedVersion)
    const currentNode = get(entry.currentlyEditing)
    const selectedKey =
      selected.type === 'status' ? selected.status : selected.ref
    return [selected.type, selectedKey, currentNode && get(currentNode.value)]
  })
  const previewPayloadSignal = debounce(previewPayloadSource, 250)
  const updatePreviewPayload = atom(null, async get => {
    if (get(preview) !== true) return undefined
    const node = await get(entry.selectedNode)
    const value = get(node.value)
    if (!isRecord(value)) return undefined
    const sha = await get(shaAtom)
    if (!sha) return undefined

    const root = get(entry.root)
    const locale = get(root.selectedLocale)
    const activeVersion = await get(entry.languages(locale).activeVersion)
    if (!activeVersion) return undefined
    const selected = get(entry.selectedVersion)
    const status =
      selected.type === 'status' ? selected.status : activeVersion.status
    const nextVersion = {
      ...activeVersion,
      title:
        typeof value.title === 'string' ? value.title : activeVersion.title,
      path: typeof value.path === 'string' ? value.path : activeVersion.path,
      data: value,
      status
    }
    const schema = get(configAtom).schema
    const baseText = decoder.decode(
      JsonLoader.format(
        schema,
        createRecord(activeVersion, activeVersion.status)
      )
    )
    const nextText = decoder.decode(
      JsonLoader.format(schema, createRecord(nextVersion, status))
    )
    const patch = await createFilePatch(baseText, nextText)
    return encodePreviewPayload({
      locale: activeVersion.locale,
      entryId: activeVersion.id,
      contentHash: sha,
      status,
      patch
    })
  })
  const previewUrlFor = dispense((locale: string | null) =>
    atom(async get => {
      if (get(preview) !== true) return undefined
      get(previewRetry)
      const client = get(clientAtom)
      if (typeof client.previewToken !== 'function') return undefined
      const config = get(configAtom)
      const sourceLocale = entry.sourceLocaleFor(get, locale)
      const activeVersion = await get(
        entry.languages(sourceLocale).activeVersionResource
      )
      if (!activeVersion) return undefined
      try {
        const base = new URL(
          config.handlerUrl ?? '',
          Config.baseUrl(config) ??
            (typeof location === 'undefined'
              ? 'http://localhost'
              : location.href)
        )
        const origin = base.origin
        if (get(previewSessionOriginsAtom).has(origin))
          return new URL(activeVersion.url, origin).toString()

        const previewToken = await requestPreviewSessionToken(
          get(previewTokenRequestsAtom),
          origin,
          client
        )
        base.searchParams.set('preview', previewToken)
        base.searchParams.set('returnTo', activeVersion.url)
        return base.toString()
      } catch {
        return undefined
      }
    })
  )

  return {
    hasPreview,
    preview,
    previewEntryFor,
    previewPayloadSignal,
    previewUrlFor,
    retryPreviewUrl,
    updatePreviewPayload
  }
}
