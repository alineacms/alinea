import {Entry, Outcome} from '@alinea/core'
import {Functions} from '@alinea/store'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {useLocale} from './UseLocale'

type QueryParams = {
  workspace: string
  root: string
  locale?: string
  open: Array<string>
  visible: Array<string>
}

function query({workspace, root, locale, open, visible}: QueryParams) {
  const Parent = Entry.as('Parent')
  let condition = Entry.parent
    .isIn(open)
    .or(Entry.id.isIn(open))
    .or(Entry.parent.isNull())
  if (locale) condition = condition.and(Entry.locale.is(locale))
  return Entry.where(condition)
    .where(Entry.workspace.is(workspace))
    .where(Entry.root.is(root))
    .where(Entry.type.isIn(visible))
    .select({
      title: Entry.title,
      id: Entry.id,
      index: Entry.index,
      workspace: Entry.workspace,
      root: Entry.root,
      type: Entry.type,
      url: Entry.url,
      parent: Entry.parent,
      parents: Entry.parents,
      $isContainer: Entry.$isContainer,
      childrenCount: Parent.where(Parent.parent.is(Entry.id))
        .select(Functions.count())
        .first()
    })
    .orderBy(Entry.index.asc())
}

type UseContentTreeOptions = {
  workspace: string
  root: string
  select: Array<string>
}

export function useContentTree({select}: UseContentTreeOptions) {
  const workspace = useWorkspace()
  const root = useRoot()
  const locale = useLocale()
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
    ['tree', locale, workspace, root, ids.join('.')],
    () => {
      return hub
        .query(
          query({
            locale,
            workspace: workspace.name,
            root: root.name,
            open: ids,
            visible
          })
        )
        .then(Outcome.unpack)
    },
    {
      keepPreviousData: true,
      suspense: true,
      cacheTime: 10,
      refetchOnWindowFocus: false
    }
  )

  const entries = data!.filter(entry => {
    return entry.parents.reduce<boolean>(
      (acc, parent) => acc && open.has(parent),
      true
    )
  })

  useEffect(() => {
    setOpen(current => new Set([...current, ...select]))
  }, [select.join('.')])
  return {entries, isOpen, toggleOpen, refetch}
}
