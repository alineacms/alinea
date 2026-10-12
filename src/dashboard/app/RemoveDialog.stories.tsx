import {
  createRemovePlan,
  type RemoveAction,
  type RemovedUrl,
  type RemovePlan,
  type RemoveSubject
} from '#/dashboard/atoms/remove.js'
import type {EntryReferenceWithSource} from '#/dashboard/atoms/entry.js'
import {cms} from '#/dashboard/fixture/cms.ts?alinea'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {useState} from 'react'
import {RemoveDialog} from './RemoveDialog.js'

function subject(
  id: string,
  title: string,
  type: string,
  locale: string | null = null,
  hasChildren = false
): RemoveSubject {
  const root = locale ? 'pages' : 'media'
  const workspace = locale ? 'i18n' : 'simple'
  return {id, title, type, workspace, root, locale, parents: [], hasChildren}
}

function reference(
  targetId: string,
  title: string,
  locale: string
): EntryReferenceWithSource {
  return {
    reference: {
      targetId,
      sourceId: title,
      sourceFilePath: `${locale}/${title}.json`,
      sourceType: 'Page',
      sourceLocale: locale,
      sourceStatus: 'published',
      sourceActive: true,
      sourceMain: true,
      fieldPath: 'link',
      fieldLabel: 'Link'
    },
    source: {
      id: title,
      title,
      type: 'Page',
      workspace: 'i18n',
      root: 'pages',
      locale,
      status: 'published',
      path: title.toLowerCase(),
      url: `/${locale}/${title.toLowerCase()}`
    }
  }
}

async function wait() {
  await new Promise(resolve => setTimeout(resolve, 600))
}

interface RemoveDialogStoryProps {
  action?: RemoveAction
  subjects: Array<RemoveSubject>
  locales?: Array<string>
  references?: Array<EntryReferenceWithSource>
  urls?: Array<RemovedUrl>
}

function RemoveDialogStory({
  action = 'delete',
  subjects,
  locales,
  references = [],
  urls = []
}: RemoveDialogStoryProps) {
  // Published entries can be archived instead
  const archivable = subjects.map(({id, locale}) => ({id, locale}))
  const open = () =>
    createRemovePlan({subjects, locales, references, archivable, urls})
  const [plan, setPlan] = useState<RemovePlan | undefined>(open)
  return (
    <StoryProvider config={cms.config}>
      <button type="button" onClick={() => setPlan(open())}>
        {action === 'delete' ? 'Delete' : 'Archive'}
      </button>
      <RemoveDialog
        action={action}
        plan={plan}
        onClose={() => setPlan(undefined)}
        onConfirm={wait}
        onArchive={wait}
      />
    </StoryProvider>
  )
}

export function DeleteFiles() {
  return (
    <RemoveDialogStory
      subjects={[
        subject('one', 'Portrait.jpg', 'MediaFile'),
        subject('two', 'Panorama.jpg', 'MediaFile')
      ]}
    />
  )
}

export function DeleteFilesAndFolders() {
  return (
    <RemoveDialogStory
      subjects={[
        subject('one', 'Portrait.jpg', 'MediaFile'),
        subject('photos', 'Photos', 'MediaLibrary', null, true),
        subject('press', 'Press kit', 'MediaLibrary')
      ]}
    />
  )
}

/** Picks the languages and lists the links to the picked ones */
export function DeleteTranslatedEntry() {
  return (
    <RemoveDialogStory
      subjects={[subject('about', 'About us', 'Page', 'en', true)]}
      locales={['en', 'fr']}
      references={[
        reference('about', 'Home', 'en'),
        reference('about', 'Contact', 'en'),
        reference('about', 'Accueil', 'fr')
      ]}
      urls={[
        {id: 'about', locale: 'en', url: '/en/about'},
        {id: 'about', locale: 'fr', url: '/fr/about'}
      ]}
    />
  )
}

/** Nothing links to the page, its URL may still be linked to elsewhere */
export function DeletePageWithoutReferences() {
  return (
    <RemoveDialogStory
      subjects={[subject('about', 'About us', 'Page', 'en')]}
      urls={[{id: 'about', locale: 'en', url: '/en/about'}]}
    />
  )
}

export function ArchivePage() {
  return (
    <RemoveDialogStory
      action="archive"
      subjects={[subject('about', 'About us', 'Page', 'en')]}
      references={[reference('about', 'Home', 'en')]}
      urls={[{id: 'about', locale: 'en', url: '/en/about'}]}
    />
  )
}

export default {
  title: 'Dashboard / RemoveDialog'
}
