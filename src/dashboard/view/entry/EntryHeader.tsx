import {Button, HStack, Icon, Stack, fromModule, px} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {PopoverMenu} from 'alinea/ui/PopoverMenu'
import {IcOutlineDrafts} from 'alinea/ui/icons/IcOutlineDrafts'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from 'alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundMoreVert} from 'alinea/ui/icons/IcRoundMoreVert'
import {IcRoundSave} from 'alinea/ui/icons/IcRoundSave'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {useLocation, useNavigate} from '../../atoms/LocationAtoms.js'
import {useLocale} from '../../hook/UseLocale.js'
import {EditMode} from './EditMode.js'
import css from './EntryHeader.module.scss'
import {Langswitch} from './LangSwitch.js'

const styles = fromModule(css)

const variantDescription = {
  draft: 'Draft',
  editing: 'Editing',
  published: 'Published',
  archived: 'Archived',
  untranslated: 'Untranslated'
}

const variantIcon = {
  draft: IcOutlineDrafts,
  editing: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
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
  const hasChanges = useAtomValue(editor.hasChanges)
  const untranslated = locale && locale !== editor.version.locale
  const variant = untranslated
    ? 'untranslated'
    : hasChanges
    ? 'editing'
    : selectedPhase
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  const saveTranslation = useSetAtom(editor.saveTranslation)
  const discardDraft = useSetAtom(editor.resetDraft)
  const translate = () => saveTranslation(locale!)
  const navigate = useNavigate()
  const {pathname} = useLocation()
  return (
    <AppBar.Root className={styles.root()} variant={variant}>
      <HStack center gap={16} className={styles.root.description()}>
        <Icon icon={variantIcon[variant]} size={18} />
        <strong className={styles.root.description.title()}>
          {variant === 'draft' && hasChanges
            ? 'Editing'
            : variantDescription[variant]}
        </strong>

        <span className={styles.root.description.separator()} />

        {!hasChanges && isActivePhase && (
          <div className={styles.root.description.action()}>
            Edit to create a new draft
          </div>
        )}

        {untranslated && !hasChanges && (
          <div className={styles.root.description.action()}>
            <HStack center>
              <span style={{marginRight: px(8)}}>Translate from</span>
              <Langswitch
                selected={editor.version.locale!}
                locales={editor.translations.map(({locale}) => locale)}
                onChange={locale => {
                  navigate(pathname + `?from=` + locale)
                }}
              />
            </HStack>
          </div>
        )}

        {hasChanges && (
          <>
            <div className={styles.root.description.action()}>
              <button
                className={styles.root.description.action.button()}
                onClick={() =>
                  setMode(
                    mode === EditMode.Editing ? EditMode.Diff : EditMode.Editing
                  )
                }
              >
                <Icon icon={MdiSourceBranch} />
                <span>
                  {mode === EditMode.Editing ? 'Show changes' : 'Close changes'}
                </span>
              </button>
            </div>

            <span className={styles.root.description.separator()} />

            <div className={styles.root.description.action()}>
              <button
                className={styles.root.description.action.button()}
                onClick={discardDraft}
              >
                <Icon icon={IcRoundDelete} />
                <span>Discard draft</span>
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
              <PopoverMenu.Trigger className={styles.root.more()}>
                <Icon icon={IcRoundMoreVert} />
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>hzere</PopoverMenu.Items>
            </PopoverMenu.Root>
          </HStack>
        </Stack.Right>
      </HStack>
    </AppBar.Root>
  )
}
