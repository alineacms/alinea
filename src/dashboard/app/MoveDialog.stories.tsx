import {getRoot, getWorkspace} from '#/core/Internal.js'
import {Policy} from '#/core/Role.js'
import {
  MoveTree,
  resolveMoveTargets,
  type MoveCandidate,
  type MoveSubject
} from '#/dashboard/atoms/move.js'
import {cms} from '#/dashboard/fixture/cms.ts?alinea'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {useState} from 'react'
import {MoveDialog} from './MoveDialog.js'

const config = cms.config

function folder(
  id: string,
  title: string,
  type: string,
  parents: Array<string> = []
): MoveCandidate {
  return {
    id,
    title,
    type,
    status: 'published',
    main: true,
    locale: null,
    parentId: parents.at(-1) ?? null,
    parents
  }
}

function subject(
  id: string,
  title: string,
  type: string,
  root: string,
  parents: Array<string> = []
): MoveSubject {
  return {
    id,
    title,
    type,
    workspace: 'simple',
    root,
    locale: null,
    parentId: parents.at(-1) ?? null,
    parents
  }
}

const mediaFolders = [
  folder('photos', 'Photos', 'MediaLibrary'),
  folder('events', 'Events', 'MediaLibrary', ['photos']),
  folder('2025', '2025', 'MediaLibrary', ['photos', 'events']),
  folder('2026', '2026', 'MediaLibrary', ['photos', 'events']),
  folder('team', 'Team', 'MediaLibrary', ['photos']),
  folder('documents', 'Documents', 'MediaLibrary'),
  folder('press', 'Press kit', 'MediaLibrary', ['documents'])
]

const pageFolders = [
  folder('home', 'Home', 'Page'),
  folder('about', 'About us', 'Page', ['home']),
  folder('docs', 'Documentation', 'Folder'),
  folder('guides', 'Guides', 'Folder', ['docs']),
  folder('api', 'API reference', 'Page', ['docs'])
]

function tree(
  root: string,
  subjects: Array<MoveSubject>,
  candidates: Array<MoveCandidate>
) {
  const rootData = getRoot(getWorkspace(config.workspaces.simple).roots[root])
  return new MoveTree(
    resolveMoveTargets({
      config,
      policy: Policy.ALLOW_ALL,
      rootData,
      workspace: 'simple',
      root,
      subjects,
      candidates
    }),
    null
  )
}

interface MoveDialogStoryProps {
  build: () => MoveTree
}

function MoveDialogStory({build}: MoveDialogStoryProps) {
  const [current, setCurrent] = useState<MoveTree | undefined>(build)
  return (
    <StoryProvider config={config}>
      <button type="button" onClick={() => setCurrent(build())}>
        Open move dialog
      </button>
      <MoveDialog tree={current} onClose={() => setCurrent(undefined)} />
    </StoryProvider>
  )
}

export function MoveMediaFile() {
  return (
    <MoveDialogStory
      build={() =>
        tree(
          'media',
          [
            subject('file', 'Landscape.jpg', 'MediaFile', 'media', [
              'photos',
              'events'
            ])
          ],
          mediaFolders
        )
      }
    />
  )
}

export function MoveSelectedMediaFiles() {
  return (
    <MoveDialogStory
      build={() =>
        tree(
          'media',
          [
            subject('one', 'Portrait.jpg', 'MediaFile', 'media'),
            subject('two', 'Panorama.jpg', 'MediaFile', 'media'),
            subject('three', 'Favicon.png', 'MediaFile', 'media')
          ],
          mediaFolders
        )
      }
    />
  )
}

/** The folder itself and its subfolders are not listed */
export function MoveMediaFolder() {
  return (
    <MoveDialogStory
      build={() =>
        tree(
          'media',
          [subject('events', 'Events', 'MediaLibrary', 'media', ['photos'])],
          mediaFolders
        )
      }
    />
  )
}

export function MovePage() {
  return (
    <MoveDialogStory
      build={() =>
        tree(
          'pages',
          [subject('contact', 'Contact', 'Page', 'pages', ['home'])],
          pageFolders
        )
      }
    />
  )
}

export function NoTargets() {
  return (
    <MoveDialogStory
      build={() =>
        tree(
          'pages',
          [subject('contact', 'Contact', 'Unknown', 'pages', ['home'])],
          pageFolders
        )
      }
    />
  )
}

export default {
  title: 'Dashboard / MoveDialog'
}
