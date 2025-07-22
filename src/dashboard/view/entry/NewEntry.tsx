import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {createId} from 'alinea/core/Id'
import {Reference} from 'alinea/core/Reference'
import {Schema} from 'alinea/core/Schema'
import {track} from 'alinea/core/Tracker'
import {Type, type} from 'alinea/core/Type'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {slugify} from 'alinea/core/util/Slugs'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useLocation, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {Modal} from 'alinea/dashboard/view/Modal'
import {EntryLink, entry} from 'alinea/field/link'
import {type SelectField, select} from 'alinea/field/select'
import {text} from 'alinea/field/text'
import {entryPicker} from 'alinea/picker/entry/EntryPicker'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {parents} from 'alinea/query'
import {Button, Loader} from 'alinea/ui'
import {Link} from 'alinea/ui/Link'
import {useAtomValue} from 'jotai'
import {type FormEvent, Suspense, useEffect, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {useConfig} from '../../hook/UseConfig.js'
import {useDb} from '../../hook/UseDb.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useTranslation} from '../../hook/useTranslation.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './NewEntry.module.scss'

const styles = styler(css)

export const copy = {
  title: 'Title',
  parent: 'Parent',
  type: 'Select type',
  order: 'Insert order',
  orderOptions: {
    first: 'At the top of the list',
    last: 'At the bottom of the list'
  },
  copy: 'Copy content from',
  formTitle: 'New entry',
  cancel: 'Cancel',
  create: 'Create'
}

const parentData = {
  id: Entry.id,
  type: Entry.type,
  path: Entry.path,
  url: Entry.url,
  level: Entry.level,
  parent: Entry.parentId,
  parentPaths: parents({
    select: Entry.path
  })
}

function NewEntryForm({parentId}: NewEntryProps) {
  const t = useTranslation(copy)
  const titleField = useMemo(() => text(t.title, {autoFocus: true}), [])
  const config = useConfig()
  const locale = useLocale()
  const db = useDb()
  const {data: requestedParent} = useQuery(
    ['parent-req', parentId],
    async () => {
      return parentId
        ? db.first({
            select: parentData,
            id: parentId,
            locale,
            status: 'preferDraft'
          })
        : null
    },
    {suspense: true, keepPreviousData: true, staleTime: 0}
  )
  const preselectedId =
    requestedParent &&
    (Type.isContainer(config.schema[requestedParent.type])
      ? requestedParent.id
      : requestedParent.parent)
  const {pathname} = useLocation()
  const nav = useNav()
  const navigate = useNavigate()
  const {name: workspace} = useWorkspace()
  const containerTypes = entries(config.schema)
    .filter(([, type]) => {
      return Type.isContainer(type!)
    })
    .map(pair => pair[0])
  const root = useRoot()
  const parentField = useMemo(() => {
    return entry(t.parent, {
      location: {workspace, root: root.name},
      condition: {_type: {in: containerTypes}},
      enableNavigation: true,
      initialValue: preselectedId
        ? {
            [Reference.id]: 'parent',
            [Reference.type]: 'entry',
            [EntryReference.entry]: preselectedId
          }
        : undefined
    })
  }, [])

  async function allowedTypes(parentId?: string): Promise<Array<string>> {
    if (!parentId) {
      return root.contains
        ? Schema.contained(config.schema, root.contains)
        : keys(config.schema)
    }
    const parent = parentId
      ? await db.get({
          select: parentData,
          id: parentId,
          status: 'preferDraft'
        })
      : null
    const parentType = parent && config.schema[parent.type]
    if (parentType)
      return Schema.contained(config.schema, Type.contains(parentType))
    return keys(config.schema)
  }

  const typeField = useMemo(() => {
    const typeField: SelectField<string> = select(t.type, {
      options: {}
    }) as any
    return track.options(typeField, async get => {
      const selectedParent = get(parentField)
      const parentId = selectedParent?.[EntryReference.entry]
      const types: Array<string> = await allowedTypes(parentId)
      return {
        options: fromEntries(
          types
            .map(key => {
              return [key, config.schema[key]] as const
            })
            .filter(row => row[1])
            .map(([key, type]) => {
              return [key, (Type.label(type) || key) as string]
            })
        )
      }
    })
  }, [])

  const insertOrderField = useMemo(() => {
    const insertOrderField: SelectField<'first' | 'last'> = select(t.order, {
      initialValue: 'last',
      options: {
        first: t.orderOptions.first,
        last: t.orderOptions.last
      }
    })
    return track.options(insertOrderField, async get => {
      const selectedParent = get(parentField)
      const parentId = selectedParent?.[EntryReference.entry]
      const parent = await db.first({
        select: {
          type: Entry.type
        },
        id: parentId,
        status: 'preferDraft'
      })
      const parentType = parent && config.schema[parent.type]
      const parentInsertOrder = parentType && Type.insertOrder(parentType)
      return {
        hidden: parentInsertOrder !== 'free'
      }
    })
  }, [])

  const copyFromField = useMemo(() => {
    const copyFromField = entry(t.copy)
    return track.options(copyFromField, get => {
      const type = get(typeField)!
      return {
        readOnly: !type,
        pickers: {
          entry: entryPicker({
            condition: {_type: type},
            title: t.copy,
            max: 1,
            selection: EntryLink
          })
        }
      }
    })
  }, [])

  const [isCreating, setIsCreating] = useState(false)

  const formType = useMemo(
    () =>
      type(t.formTitle, {
        fields: {
          parent: parentField,
          title: titleField,
          type: typeField,
          order: insertOrderField,
          copyFrom: copyFromField
        }
      }),
    []
  )
  const form = useForm(formType)

  const parentAtoms = form.fieldInfo(parentField)
  const typeAtoms = form.fieldInfo(typeField)
  const copyFromAtoms = form.fieldInfo(copyFromField)
  const selectedType = useAtomValue(typeAtoms.value)
  const selectedParent = useAtomValue(parentAtoms.value)

  useEffect(() => {
    allowedTypes(selectedParent?.[EntryReference.entry]).then(types => {
      if (types.length > 0) typeAtoms.mutator(types[0])
    })
  }, [selectedParent])

  useEffect(() => {
    copyFromAtoms.mutator.replace(undefined!)
  }, [selectedType])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const {title, type: selected} = form.data()
    if (isCreating || !selected || !title) return
    setIsCreating(true)
    const path = slugify(title)
    const id = createId()
    const parentId = form.data().parent?.[EntryReference.entry]
    const entryType = config.schema[selected]!
    const copyFrom = form.data().copyFrom?.[EntryReference.entry]
    const entryData = copyFrom
      ? await db.first({
          select: Entry.data,
          id: copyFrom,
          locale: locale,
          status: 'preferPublished'
        })
      : Type.initialValue(entryType)
    const parent = parentId ? await db.first({id: parentId}) : undefined
    const parentType = parent && config.schema[parent._type]
    const parentInsertOrder = parentType && Type.insertOrder(parentType)
    return db
      .create({
        type: entryType,
        id: id,
        insertOrder:
          !parentInsertOrder || parentInsertOrder === 'free'
            ? form.data().order
            : parentInsertOrder,
        parentId: parentId,
        locale: locale,
        root: root.name,
        workspace: workspace,
        status: config.enableDrafts ? 'draft' : 'published',
        set: {...entryData, title, path}
      })
      .then(entry => {
        navigate(nav.entry({id: entry._id}))
      })
      .finally(() => {
        setIsCreating(false)
      })
  }
  return (
    <form
      onSubmit={handleCreate}
      className={styles.form({loading: isCreating})}
    >
      {isCreating && <Loader absolute />}
      <InputForm border={false} form={form} />
      <div className={styles.root.footer()}>
        <Link href={pathname} className={styles.root.footer.link()}>
          {t.cancel}
        </Link>
        <Button>{t.create}</Button>
      </div>
    </form>
  )
}

export type NewEntryProps = {parentId?: string}

export function NewEntry({parentId}: NewEntryProps) {
  const navigate = useNavigate()
  const {pathname} = useLocation()
  function handleClose() {
    navigate(pathname)
  }
  return (
    <Modal open onClose={handleClose} className={styles.root()}>
      <Suspense fallback={<Loader />}>
        <NewEntryForm parentId={parentId} />
      </Suspense>
    </Modal>
  )
}
