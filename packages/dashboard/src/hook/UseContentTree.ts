import {Entry, Outcome} from '@alinea/core'
import {Functions, Store} from '@alinea/store'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'

type QueryParams = {
  workspace: string
  root: string
  locale?: string
  open: Array<string>
  visible: Array<string>
}

export type ContentTreeEntry = Store.TypeOf<ReturnType<typeof query>>[0]

function query({workspace, root, locale, open, visible}: QueryParams) {
  const Parent = Entry.as('Parent')
  const id = locale ? Entry.i18n.id : Entry.id
  const parent = locale ? Entry.i18n.parent : Entry.parent
  const summary = {
    id,
    source: {
      id: Entry.id,
      parent: Entry.parent,
      parents: Entry.parents
    },
    locale: Entry.i18n.locale,
    title: Entry.title,
    index: Entry.index,
    workspace: Entry.workspace,
    root: Entry.root,
    type: Entry.type,
    url: Entry.url,
    parent,
    parents: locale ? Entry.i18n.parents : Entry.parents,
    $isContainer: Entry.$isContainer,
    childrenCount: Parent.where(
      (locale ? Parent.i18n.parent : Parent.parent).is(Entry.id)
    )
      .select(Functions.count())
      .first()
  }
  let openEntries = parent.isIn(open).or(id.isIn(open)).or(parent.isNull())
  let condition = openEntries
  if (locale) {
    condition = condition.and(Entry.i18n.locale.is(locale))
  }
  let query = Entry.where(condition)
    .where(Entry.workspace.is(workspace))
    .where(Entry.root.is(root))
    .where(Entry.type.isIn(visible))
    .select(summary)
  if (locale) {
    const translatedCondition = openEntries
      .and(Entry.i18n.locale.isNot(locale))
      .and(Entry.i18n.id.isNotIn(query.select(Entry.i18n.id)))
    query = query.union(
      Entry.where(translatedCondition)
        .where(Entry.workspace.is(workspace))
        .where(Entry.root.is(root))
        .where(Entry.type.isIn(visible))
        .select(summary)
        .groupBy(Entry.i18n.id)
    )
  }
  return query
}

type UseContentTreeOptions = {
  locale: string | undefined
  workspace: string
  root: string
  select: Array<string>
}

export function useContentTree({
  locale: currentLocale,
  select
}: UseContentTreeOptions) {
  const workspace = useWorkspace()
  const root = useRoot()
  const {hub} = useSession()
  const persistenceId = `@alinea/dashboard/tree-${workspace}-${root.name}`
  const [open, setOpen] = useState(() => {
    const stored = window?.localStorage?.getItem(persistenceId)
    const opened = stored && JSON.parse(stored)
    return new Set<string>([
      ...select,
      ...(Array.isArray(opened) ? opened : [])
    ])
  })
  const isOpen = useCallback((id: string) => open.has(id), [open])
  const toggleOpen = useCallback(
    (id: string) => {
      setOpen(currentOpen => {
        const res = new Set(currentOpen)
        if (res.has(id)) res.delete(id)
        else res.add(id)
        window?.localStorage?.setItem(persistenceId, JSON.stringify([...res]))
        return res
      })
    },
    [setOpen]
  )
  const visible = useMemo(() => {
    const schema = workspace.schema
    return Array.from(schema)
      .filter(([, type]) => !type.options.isHidden)
      .map(([key]) => key)
  }, [workspace])
  const ids = Array.from(new Set([...open, ...select])).sort()
  const {data, refetch} = useQuery(
    ['tree', currentLocale, workspace.name, root.name, ids.join('.')],
    () => {
      return hub
        .query({
          cursor: query({
            locale: currentLocale,
            workspace: workspace.name,
            root: root.name,
            open: ids,
            visible
          })
        })
        .then(Outcome.unpack)
        .then(results => {
          return {locale: currentLocale, results}
        })
    },
    {
      keepPreviousData: true,
      suspense: true,
      cacheTime: 10,
      refetchOnWindowFocus: false
    }
  )

  const {locale, results} = data!

  const index = new Map(results.map(entry => [entry.id, entry]))

  const entries = results.filter(entry => {
    return entry.parents.reduce<boolean>(
      (acc, parent) => acc && open.has(parent),
      true
    )
  })

  useEffect(() => {
    setOpen(current => new Set([...current, ...select]))
  }, [select.join('.')])
  return {locale, entries, isOpen, toggleOpen, refetch, index}
}
