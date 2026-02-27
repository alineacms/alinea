import {Entry} from 'alinea/core/Entry'
import {useEffect, useState} from 'react'
import {useApp} from '../../hooks'

export interface SelectedEntry {
  id: string
  title: string
  type: string
  status: string
  workspace: string
  root: string
  locale: string | null
  parentId: string | null
  path: string
  url: string
  filePath: string
  fileHash: string
  rowHash: string
  data: Record<string, unknown>
}

interface State {
  loading: boolean
  value: SelectedEntry | null
  error?: string
}

export function useSelectedEntry(
  workspace: string,
  root: string,
  entryId?: string
): State {
  const {db} = useApp()
  const [state, setState] = useState<State>({loading: false, value: null})

  useEffect(() => {
    let active = true
    if (!entryId) {
      setState({loading: false, value: null})
      return
    }
    setState(prev => ({...prev, loading: true, error: undefined}))
    db.first({
      select: {
        id: Entry.id,
        title: Entry.title,
        type: Entry.type,
        status: Entry.status,
        workspace: Entry.workspace,
        root: Entry.root,
        locale: Entry.locale,
        parentId: Entry.parentId,
        path: Entry.path,
        url: Entry.url,
        filePath: Entry.filePath,
        fileHash: Entry.fileHash,
        rowHash: Entry.rowHash,
        data: Entry.data
      },
      id: entryId,
      workspace,
      root,
      status: 'preferDraft'
    })
      .then(value => {
        if (!active) return
        setState({loading: false, value: (value as SelectedEntry | null) ?? null})
      })
      .catch(error => {
        if (!active) return
        setState({
          loading: false,
          value: null,
          error: error instanceof Error ? error.message : String(error)
        })
      })
    return () => {
      active = false
    }
  }, [db, workspace, root, entryId])

  return state
}
