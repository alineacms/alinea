import type {PreviewMetadata} from '#/core/Preview.js'
import {atom} from 'jotai'

export const previewMetadataAtom = atom<PreviewMetadata | undefined>(undefined)
export const previewOriginAtom = atom<string | undefined>(undefined)
