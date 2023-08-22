import {EntryPhase} from 'alinea/core'
import {Button, HStack, Icon, Stack, fromModule, px} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import IcOutlineAvTimer from 'alinea/ui/icons/IcOutlineAvTimer'
import {IcOutlineDrafts} from 'alinea/ui/icons/IcOutlineDrafts'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from 'alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundMoreVert} from 'alinea/ui/icons/IcRoundMoreVert'
import {IcRoundSave} from 'alinea/ui/icons/IcRoundSave'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useAtomValue, useSetAtom} from 'jotai'
import {useEffect} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {useLocation, useNavigate} from '../../atoms/LocationAtoms.js'
import {useLocale} from '../../hook/UseLocale.js'
import css from './EntryHeader.module.scss'
import {Langswitch} from './LangSwitch.js'

const styles = fromModule(css)

const variantDescription = {
  draft: 'Draft',
  editing: 'Editing',
  published: 'Published',
  publishing: 'Publishing',
  archived: 'Archived',
  archiving: 'Archiving',
  untranslated: 'Untranslated'
}

const variantIcon = {
  draft: IcOutlineDrafts,
  editing: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
  publishing: IcOutlineAvTimer,
  archived: IcRoundArchive,
  archiving: IcOutlineAvTimer,
  untranslated: IcRoundTranslate
}

export interface EntryHeaderProps {
  editor: EntryEditor
}

const enableDrafts = false

export function EntryHeader({editor}: EntryHeaderProps) {
  const locale = useLocale()
  const phaseInUrl = useAtomValue(editor.phaseInUrl)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const isActivePhase = editor.activePhase === selectedPhase
  const isPublishing = useAtomValue(editor.isPublishing)
  const isArchiving = useAtomValue(editor.isArchiving)
  const hasChanges = useAtomValue(editor.hasChanges)
  const untranslated = locale && locale !== editor.activeVersion.locale
  const variant = untranslated
    ? 'untranslated'
    : hasChanges && !phaseInUrl
    ? 'editing'
    : selectedPhase === EntryPhase.Published && isPublishing
    ? 'publishing'
    : selectedPhase === EntryPhase.Archived && isArchiving
    ? 'archiving'
    : selectedPhase
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishEdits = useSetAtom(editor.publishEdits)
  const publishDraft = useSetAtom(editor.publishDraft)
  const discardDraft = useSetAtom(editor.discardDraft)
  const archivePublished = useSetAtom(editor.archivePublished)
  const publishArchived = useSetAtom(editor.publishArchived)
  const deleteArchived = useSetAtom(editor.deleteArchived)
  const saveTranslation = useSetAtom(editor.saveTranslation)
  const discardEdits = useSetAtom(editor.discardEdits)
  const translate = () => saveTranslation(locale!)
  const navigate = useNavigate()
  const {pathname} = useLocation()
  useEffect(() => {
    // Reset the selected phase if we make edits
    if (hasChanges && selectedPhase) navigate(pathname)
  }, [hasChanges])
  const options =
    variant === 'draft' ? (
      <DropdownMenu.Item
        className={styles.root.action()}
        onClick={discardDraft}
      >
        Remove draft
      </DropdownMenu.Item>
    ) : variant === EntryPhase.Published && !editor.activeVersion.seeded ? (
      <DropdownMenu.Item
        className={styles.root.action()}
        onClick={archivePublished}
      >
        Archive
      </DropdownMenu.Item>
    ) : variant === EntryPhase.Archived ? (
      <>
        <DropdownMenu.Item
          className={styles.root.action()}
          onClick={publishArchived}
        >
          Publish
        </DropdownMenu.Item>
        <DropdownMenu.Item
          className={styles.root.action()}
          onClick={deleteArchived}
        >
          Delete
        </DropdownMenu.Item>
      </>
    ) : null

  return (
    <AppBar.Root className={styles.root()} variant={variant}>
      <HStack center gap={12} className={styles.root.description()}>
        <Icon icon={variantIcon[variant]} size={18} />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={styles.root.description.title()}>
            <HStack center gap={4}>
              <span>{variantDescription[variant]}</span>
              {editor.availablePhases.length > 1 && (
                <Icon icon={IcRoundUnfoldMore} />
              )}
            </HStack>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items bottom>
            {hasChanges && (
              <DropdownMenu.Item
                onClick={() => {
                  navigate(pathname)
                }}
              >
                Editing
              </DropdownMenu.Item>
            )}
            {editor.availablePhases.map(phase => {
              return (
                <DropdownMenu.Item
                  key={phase}
                  onClick={() => {
                    navigate(`${pathname}?${phase}`)
                  }}
                >
                  {variantDescription[phase]}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Items>
        </DropdownMenu.Root>

        {!hasChanges && isActivePhase && !untranslated && (
          <>
            <span className={styles.root.description.separator()} />
            <div className={styles.root.description.action()}>
              Edit to create a new draft
            </div>
          </>
        )}

        {!hasChanges &&
          !isActivePhase &&
          editor.availablePhases.includes(EntryPhase.Draft) && (
            <>
              <span className={styles.root.description.separator()} />
              <div className={styles.root.description.action()}>
                A newer draft version is available
              </div>
            </>
          )}

        {untranslated && !editor.parentNeedsTranslation && !hasChanges && (
          <>
            <span className={styles.root.description.separator()} />
            <div className={styles.root.description.action()}>
              <HStack center>
                <span style={{marginRight: px(8)}}>Translate from</span>
                <Langswitch
                  selected={editor.activeVersion.locale!}
                  locales={editor.translations.map(({locale}) => locale)}
                  onChange={locale => {
                    navigate(pathname + `?from=` + locale)
                  }}
                />
              </HStack>
            </div>
          </>
        )}

        {untranslated && editor.parentNeedsTranslation && (
          <>
            <span className={styles.root.description.separator()} />
            <div className={styles.root.description.action()}>
              Translate parent page first
            </div>
          </>
        )}

        {variant === 'editing' && (
          <>
            <span className={styles.root.description.separator()} />

            <div className={styles.root.description.action()}>
              <button
                className={styles.root.description.action.button()}
                onClick={discardEdits}
              >
                <Icon icon={IcRoundDelete} />
                <span>Discard edits</span>
              </button>
            </div>
          </>
        )}

        <Stack.Right>
          <HStack center gap={12}>
            {untranslated && !editor.parentNeedsTranslation && (
              <Button icon={IcRoundSave} onClick={translate}>
                Save translation
              </Button>
            )}
            {enableDrafts && variant === 'editing' && (
              <Button icon={IcRoundSave} onClick={saveDraft}>
                Save draft
              </Button>
            )}
            {!enableDrafts && variant === 'editing' && (
              <Button icon={IcRoundSave} onClick={publishEdits}>
                Publish
              </Button>
            )}
            {!untranslated && !hasChanges && selectedPhase === 'draft' && (
              <Button icon={IcRoundCheck} onClick={publishDraft}>
                Publish draft
              </Button>
            )}

            {options && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className={styles.root.more(variant)}>
                  <Icon icon={IcRoundMoreVert} />
                </DropdownMenu.Trigger>

                <DropdownMenu.Items bottom right>
                  {options}
                </DropdownMenu.Items>
              </DropdownMenu.Root>
            )}
          </HStack>
        </Stack.Right>
      </HStack>
    </AppBar.Root>
  )
}
