import {Button, DialogTrigger, Label} from '#/components.js'
import {createId} from '#/core/Id.js'
import {Reference} from '#/core/Reference.js'
import {type LinkRow as LinkFieldRow} from '#/field/link.js'
import {LinkField, LinksField} from '#/field/link/LinkField.js'
import {EntryReference} from '#/types.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import type {ReactNode} from 'react'
import {
  IcRoundAdd,
  IcRoundClose,
  IcRoundLink,
  IcRoundSwapHoriz
} from '../../../icons.js'
import {
  ReactiveNode,
  useDashboard,
  useField,
  useFieldNode,
  useFieldOptions
} from '../../../store.js'
import {ExternalLinkPicker} from '../../ExternalLinkPicker.js'
import {ImagePicker} from '../../ImagePicker.js'
import {LinkPicker} from '../../LinkPicker.js'
import {Surface, SurfaceHeader} from '../../ui/Surface.js'
import css from './LinkField.module.css'

const styles = styler(css)

interface LinkRowProps {
  node: ReactiveNode<Reference>
}

function LinkRow({node}: LinkRowProps) {
  const type = useAtomValue(node.field('_type')) as string | undefined
  if (type === 'entry' || type === 'image') return <EntryRowLayer node={node} />
  if (type === 'url') return <UrlRow node={node} />
  return null
}

interface RowLayerProps {
  node: ReactiveNode<Reference>
}

function EntryRowLayer({node}: RowLayerProps) {
  const entryId = useAtomValue(node.field('_entry')) as string | undefined
  if (!entryId) return null
  return <EntryRow entryId={entryId} />
}

interface EntryRowProps {
  entryId: string
}

function EntryRow({entryId}: EntryRowProps) {
  const dashboard = useDashboard()
  const entry = useAtomValue(dashboard.entries(entryId))
  const label = useAtomValue(entry.label)
  const type = useAtomValue(entry.type)
  return (
    <>
      <IcRoundLink /> {label} ({type.label})
    </>
  )
}

function UrlRow({node}: RowLayerProps) {
  const title = useAtomValue(node.field('_title')) as string | undefined
  const url = useAtomValue(node.field('_url')) as string | undefined
  return (
    <>
      <IcRoundLink /> {title} ({url})
    </>
  )
}

interface StandardFieldActionProps {
  field: LinkField<LinkFieldRow, unknown>
}

interface SingleLinkDialogProps extends StandardFieldActionProps {
  children: ReactNode
}

function SingleLinkDialog({field, children}: SingleLinkDialogProps) {
  const [value, setValue] = useField(field)
  return (
    <DialogTrigger>
      <Button appearance="plain" intent="secondary">
        {children}
      </Button>
      <LinkPicker
        selectionMode="single"
        selectionBehavior="replace"
        initialSelection={
          value?._type === 'entry' ? [(value as EntryReference)._entry] : []
        }
        onConfirm={selection =>
          setValue({
            _id: createId(),
            _type: 'entry',
            _index: '',
            _entry: selection[0]
          } satisfies LinkFieldRow)
        }
      />
    </DialogTrigger>
  )
}

function SingleExternalDialog({field, children}: SingleLinkDialogProps) {
  const [, setValue] = useField(field)
  return (
    <DialogTrigger>
      <Button appearance="plain" intent="secondary">
        {children}
      </Button>
      <ExternalLinkPicker
        selectionMode="single"
        onConfirm={({url, title, target}) =>
          setValue({
            _id: createId(),
            _type: 'url',
            _index: '',
            _url: url,
            _title: title,
            _target: target
          } satisfies LinkFieldRow)
        }
      />
    </DialogTrigger>
  )
}

function SingleImageDialog({field, children}: SingleLinkDialogProps) {
  const [value, setValue] = useField(field)
  return (
    <DialogTrigger>
      <Button appearance="plain" intent="secondary">
        {children}
      </Button>
      <ImagePicker
        selectionMode="single"
        selectionBehavior="replace"
        initialSelection={
          value?._type === 'image' ? [(value as EntryReference)._entry] : []
        }
        onConfirm={selection =>
          setValue({
            _id: createId(),
            _type: 'image',
            _index: '',
            _entry: selection[0]
          } satisfies LinkFieldRow)
        }
      />
    </DialogTrigger>
  )
}

interface MultipleLinkDialogProps {
  field: LinksField<LinkFieldRow, unknown>
  children: ReactNode
}

function MultipleLinkDialog({field, children}: MultipleLinkDialogProps) {
  const [value, setValue] = useField(field)
  return (
    <DialogTrigger>
      <Button intent="secondary" appearance="plain">
        {children}
      </Button>
      <LinkPicker
        selectionMode="multiple"
        selectionBehavior="toggle"
        initialSelection={value
          ?.filter(row => '_entry' in row)
          .map(row => row._entry as string)}
        onConfirm={selection =>
          setValue(
            selection.map(
              entryId =>
                ({
                  _id: createId(),
                  _index: '',
                  _type: 'entry',
                  _entry: entryId
                }) satisfies LinkFieldRow
            )
          )
        }
      />
    </DialogTrigger>
  )
}

interface AllowedActions {
  allowLinks?: boolean
  allowExternalLinks?: boolean
  allowImages?: boolean
}

interface SingleFieldActionsProps
  extends AllowedActions, StandardFieldActionProps {}

function SingleFieldActions({
  field,
  allowLinks = false,
  allowExternalLinks = false,
  allowImages = false
}: SingleFieldActionsProps) {
  return (
    <>
      {allowLinks && (
        <SingleLinkDialog field={field}>
          <IcRoundAdd /> Add link
        </SingleLinkDialog>
      )}
      {allowExternalLinks && (
        <SingleExternalDialog field={field}>
          <IcRoundAdd /> Add external link
        </SingleExternalDialog>
      )}
      {allowImages && (
        <SingleImageDialog field={field}>
          <IcRoundAdd /> Add image
        </SingleImageDialog>
      )}
    </>
  )
}

export interface SingleLinkFieldViewProps {
  field: LinkField<LinkFieldRow, unknown>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  const [, setValue] = useField(field)
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  const isEmpty = useAtomValue(node.isEmpty)
  const allowLinks = 'entry' in options.pickers
  const allowExternalLinks = 'url' in options.pickers
  const allowImages = 'image' in options.pickers
  return (
    <Label label={options.label}>
      <Surface className={styles.LinkFieldView()}>
        {!isEmpty && (
          <SurfaceHeader className={styles.LinkFieldView.row()}>
            <div className={styles.LinkFieldView.actions()}>
              <LinkRow node={node as ReactiveNode<Reference>} />
            </div>
            <div className={styles.LinkFieldView.actions()}>
              {allowLinks && (
                <SingleLinkDialog field={field}>
                  <IcRoundSwapHoriz />
                </SingleLinkDialog>
              )}
              <Button
                size="icon"
                appearance="plain"
                intent="secondary"
                onPress={() => setValue(undefined!)}
                icon={IcRoundClose}
              />
            </div>
          </SurfaceHeader>
        )}
        {isEmpty && (
          <SurfaceHeader
            className={styles.LinkFieldView.row(
              styles.LinkFieldView.rowCenter()
            )}
          >
            <div className={styles.LinkFieldView.actions()}>
              <SingleFieldActions
                field={field}
                allowImages={allowImages}
                allowExternalLinks={allowExternalLinks}
                allowLinks={allowLinks}
              />
            </div>
          </SurfaceHeader>
        )}
      </Surface>
    </Label>
  )
}

export interface MultipleLinksFieldViewProps {
  field: LinksField<LinkFieldRow, unknown>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  const [, setValue] = useField(field)
  const options = useFieldOptions(field)
  const node = useFieldNode(field)
  const nodes = useAtomValue(node.nodes) as Array<ReactiveNode<Reference>>
  return (
    <Label label={options.label}>
      <Surface className={styles.MultipleLinksFieldView()}>
        {nodes?.map((node, index) => (
          <SurfaceHeader
            key={index}
            className={styles.MultipleLinksFieldView.row()}
          >
            <div className={styles.MultipleLinksFieldView.actions()}>
              <LinkRow key={index} node={node} />
            </div>
            <Button
              size="icon"
              appearance="plain"
              intent="secondary"
              icon={IcRoundClose}
              onPress={() =>
                setValue(links =>
                  links.filter((_, currentIndex) => currentIndex !== index)
                )
              }
            />
          </SurfaceHeader>
        ))}
        <SurfaceHeader
          className={styles.MultipleLinksFieldView.row(
            styles.MultipleLinksFieldView.rowCenter()
          )}
        >
          <div className={styles.MultipleLinksFieldView.actions()}>
            <MultipleLinkDialog field={field}>
              <IcRoundAdd />
              Add/Remove Link(s)
            </MultipleLinkDialog>
          </div>
        </SurfaceHeader>
      </Surface>
    </Label>
  )
}
