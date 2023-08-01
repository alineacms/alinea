import {Button, HStack, Icon, Stack, fromModule, px} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {useLocation, useNavigate} from '../../atoms/LocationAtoms.js'
import {useLocale} from '../../hook/UseLocale.js'
import {EditMode} from './EditMode.js'
import css from './EntryHeader.module.scss'
import {Langswitch} from './LangSwitch.js'

const styles = fromModule(css)

const variantDescription = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  untranslated: 'Untranslated'
}

const variantIcon = {
  draft: IcRoundEdit,
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
  const isSaving = useAtomValue(editor.isSaving)
  const untranslated = locale && locale !== editor.version.locale
  const variant = untranslated
    ? 'untranslated'
    : (hasChanges || isSaving) && isActivePhase
    ? 'draft'
    : selectedPhase
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  const saveTranslation = useSetAtom(editor.saveTranslation)
  const translate = () => saveTranslation(locale!)
  const navigate = useNavigate()
  const {pathname} = useLocation()
  return (
    <AppBar.Root variant={variant}>
      <HStack center gap={12} className={styles.root.description()}>
        <Icon icon={variantIcon[variant]} size={18} />
        <strong className={styles.root.description.title()}>
          {variantDescription[variant]}
        </strong>
        <div className={styles.root.description.action()}>
          {untranslated && !hasChanges ? (
            <HStack center>
              <span style={{marginRight: px(8)}}>Translate from</span>
              <Langswitch
                selected={editor.version.locale!}
                locales={editor.translations.map(({locale}) => locale)}
                onChange={locale => {
                  navigate(pathname + `?` + locale)
                }}
              />
            </HStack>
          ) : (
            isActivePhase &&
            (hasChanges || isSaving ? (
              <button
                onClick={() =>
                  setMode(
                    mode === EditMode.Editing ? EditMode.Diff : EditMode.Editing
                  )
                }
              >
                {mode === EditMode.Editing ? 'Show changes' : 'Close changes'}
              </button>
            ) : (
              <>Edit to create a new draft</>
            ))
          )}
        </div>

        <Stack.Right>
          <HStack center gap={8}>
            {untranslated && (
              <Button icon={IcRoundCheck} onClick={translate}>
                Save translation
              </Button>
            )}
            {hasChanges && variant === 'draft' && (
              <Button icon={IcRoundCheck} onClick={saveDraft}>
                Save draft
              </Button>
            )}
            {!untranslated && !hasChanges && selectedPhase === 'draft' && (
              <Button icon={IcOutlineRemoveRedEye} onClick={publishDraft}>
                Publish draft
              </Button>
            )}

            {/*<PopoverMenu.Root>
              <PopoverMenu.Trigger>
                <Icon icon={IcRoundMoreVert} />
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>open me</PopoverMenu.Items>
            </PopoverMenu.Root>*/}
          </HStack>
        </Stack.Right>
      </HStack>
    </AppBar.Root>
  )
}
