import {EntryPhase} from 'alinea/core'
import {Button, HStack, Icon, Stack, fromModule, px} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {PopoverMenu} from 'alinea/ui/PopoverMenu'
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
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
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
  untranslated: 'Untranslated'
}

const variantIcon = {
  draft: IcOutlineDrafts,
  editing: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
  publishing: IcOutlineAvTimer,
  archived: IcRoundArchive,
  untranslated: IcRoundTranslate
}

export interface EntryHeaderProps {
  editor: EntryEditor
}

export function EntryHeader({editor}: EntryHeaderProps) {
  const locale = useLocale()
  const [mode, setMode] = useAtom(editor.editMode)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const isActivePhase = editor.activePhase === selectedPhase
  const isPublishing = useAtomValue(editor.isPublishing)
  const hasChanges = useAtomValue(editor.hasChanges)
  const untranslated = locale && locale !== editor.activeVersion.locale
  const variant = untranslated
    ? 'untranslated'
    : hasChanges
    ? 'editing'
    : selectedPhase === EntryPhase.Published && isPublishing
    ? 'publishing'
    : selectedPhase
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  const discardDraft = useSetAtom(editor.discardDraft)
  const saveTranslation = useSetAtom(editor.saveTranslation)
  const discardEdits = useSetAtom(editor.discardEdits)
  const translate = () => saveTranslation(locale!)
  const navigate = useNavigate()
  const {pathname} = useLocation()
  return (
    <AppBar.Root className={styles.root()} variant={variant}>
      <HStack center gap={12} className={styles.root.description()}>
        <Icon icon={variantIcon[variant]} size={18} />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className={styles.root.description.title()}>
            <HStack center gap={4}>
              <span>
                {variant === 'draft' && hasChanges
                  ? 'Editing'
                  : variantDescription[variant]}
              </span>
              {editor.availablePhases.length > 1 && (
                <Icon icon={IcRoundUnfoldMore} />
              )}
            </HStack>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items placement="bottom">
            {editor.availablePhases.map(phase => {
              return (
                <DropdownMenu.Item
                  key={phase}
                  onClick={() => {
                    const search =
                      phase === editor.activePhase ? '' : `?${phase}`
                    navigate(pathname + search)
                  }}
                >
                  {variantDescription[phase]}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Items>
        </DropdownMenu.Root>
        {/*<strong className={styles.root.description.title()}>
          {variant === 'draft' && hasChanges
            ? 'Editing'
            : variantDescription[variant]}
        </strong>*/}

        {!hasChanges && isActivePhase && (
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

        {untranslated && !hasChanges && (
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

        {hasChanges && (
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

        {/*variant === 'draft' &&
          editor.availablePhases.includes(EntryPhase.Published) && (
            <>
              <span className={styles.root.description.separator()} />
              <div className={styles.root.description.action()}>
                <a
                  className={styles.root.description.action.button()}
                  href={'#' + pathname + `?published`}
                >
                  Currently published
                </a>
              </div>
            </>
          )*/}

        <Stack.Right>
          <HStack center gap={12}>
            {untranslated && (
              <Button icon={IcRoundSave} onClick={translate}>
                Save translation
              </Button>
            )}
            {variant === 'editing' && (
              <Button icon={IcRoundSave} onClick={saveDraft}>
                Save draft
              </Button>
            )}
            {!untranslated && !hasChanges && selectedPhase === 'draft' && (
              <Button icon={IcRoundCheck} onClick={publishDraft}>
                Publish draft
              </Button>
            )}

            <PopoverMenu.Root>
              <PopoverMenu.Trigger className={styles.root.more(variant)}>
                <Icon icon={IcRoundMoreVert} />
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>
                {variant === 'draft' && (
                  <button onClick={discardDraft}>Remove draft</button>
                )}
              </PopoverMenu.Items>
            </PopoverMenu.Root>
          </HStack>
        </Stack.Right>
      </HStack>
    </AppBar.Root>
  )
}
