import {Entry, Outcome} from '@alinea/core'
import {Functions} from '@alinea/store/sqlite/Functions'
import {useCallback, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {useDashboard} from '../hook/UseDashboard'
import {useSession} from '../hook/UseSession'

type QueryParams = {
  workspace: string
  root: string
  open: Array<string>
  hidden: Array<string>
}

function query({workspace, root, open, hidden}: QueryParams) {
  const Parent = Entry.as('Parent')
  const condition =
    open.length > 0
      ? Entry.parent.isIn(open).or(Entry.id.isIn(open))
      : Entry.parent.isNull()
  return Entry.where(condition)
    .where(Entry.workspace.is(workspace))
    .where(Entry.root.is(root))
    .where(Entry.type.isNotIn(hidden))
    .select({
      id: Entry.id,
      index: Entry.index,
      workspace: Entry.workspace,
      root: Entry.root,
      type: Entry.type,
      title: Entry.title,
      url: Entry.url,
      parent: Entry.parent,
      parents: Entry.parents,
      $isContainer: Entry.$isContainer,
      childrenCount: Parent.where(Parent.parent.is(Entry.id))
        .select(Functions.count())
        .first()
    })
}

function sortByIndex(entries: Array<Entry.Summary>) {
  const index = new Map(entries.map(entry => [entry.id, entry]))
  function parentIndex(id: string) {
    const parent = index.get(id)!
    if (!parent) {
      console.log(entries)
      console.log(index)
      console.log(id)
    }
    return parent.index || parent.id
  }
  function indexOf(entry: Entry.Summary) {
    return entry.parents
      .map(parentIndex)
      .concat(entry.index || entry.id)
      .join('.')
  }
  return entries.sort((a, b) => indexOf(a).localeCompare(indexOf(b)))
}

type UseContentTreeOptions = {
  workspace: string
  root: string
  select: Array<string>
}

export function useContentTree({
  workspace,
  root,
  select
}: UseContentTreeOptions) {
  const {config} = useDashboard()
  const {hub} = useSession()
  const [open, setOpen] = useState(() => new Set<string>(select))
  const isOpen = useCallback((path: string) => open.has(path), [open])
  const toggleOpen = useCallback(
    (path: string) => {
      setOpen(currentOpen => {
        const res = new Set(currentOpen)
        if (res.has(path)) res.delete(path)
        else res.add(path)
        return res
      })
    },
    [setOpen]
  )
  const hidden = useMemo(() => {
    const schema = config.workspaces[workspace].schema
    return Array.from(schema)
      .filter(([, type]) => type.options.isHidden)
      .map(([key]) => key)
  }, [workspace])
  const ids = Array.from(new Set([...open, ...select])).sort()
  const {data} = useQuery(
    ['tree', workspace, root, ids.join('.')],
    () => {
      return hub
        .query(query({workspace, root, open: ids, hidden}))
        .then(Outcome.unpack)
        .then(sortByIndex)
    },
    {
      keepPreviousData: true,
      suspense: true,
      cacheTime: 0,
      refetchOnWindowFocus: false
    }
  )
  const entries = data!.filter(entry => {
    return entry.parents.reduce<boolean>(
      (acc, parent) => acc && open.has(parent),
      true
    )
  })
  return {entries, isOpen, toggleOpen}
}
