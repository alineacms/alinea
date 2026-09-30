import {
  createDeletePlan,
  type DeletePlan,
  type DeleteSubject
} from '#/dashboard/atoms/delete.js'
import type {EntryReferenceWithSource} from '#/dashboard/atoms/entry.js'
import {cms} from '#/dashboard/fixture/cms.ts?alinea'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {useState} from 'react'
import {DeleteDialog} from './DeleteDialog.js'

function subject(
  id: string,
  title: string,
  type: string,
  locale: string | null = null,
  hasChildren = false
): DeleteSubject {
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

interface DeleteDialogStoryProps {
  subjects: Array<DeleteSubject>
  locales?: Array<string>
  references?: Array<EntryReferenceWithSource>
}

function DeleteDialogStory({
  subjects,
  locales = [],
  references = []
}: DeleteDialogStoryProps) {
  const open = () => createDeletePlan(subjects, locales, references)
  const [plan, setPlan] = useState<DeletePlan | undefined>(open)
  return (
    <StoryProvider config={cms.config}>
      <button type="button" onClick={() => setPlan(open())}>
        Delete
      </button>
      <DeleteDialog
        plan={plan}
        onClose={() => setPlan(undefined)}
        onConfirm={wait}
      />
    </StoryProvider>
  )
}

export function DeleteFiles() {
  return (
    <DeleteDialogStory
      subjects={[
        subject('one', 'Portrait.jpg', 'MediaFile'),
        subject('two', 'Panorama.jpg', 'MediaFile')
      ]}
    />
  )
}

export function DeleteFilesAndFolders() {
  return (
    <DeleteDialogStory
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
    <DeleteDialogStory
      subjects={[subject('about', 'About us', 'Page', 'en', true)]}
      locales={['en', 'fr']}
      references={[
        reference('about', 'Home', 'en'),
        reference('about', 'Contact', 'en'),
        reference('about', 'Accueil', 'fr')
      ]}
    />
  )
}

export default {
  title: 'Dashboard / DeleteDialog'
}
