import {useQuery} from 'react-query'
import {useDrafts} from './UseDrafts'

export function useDraftsList(workspace: string) {
  const drafts = useDrafts()
  const {data, refetch} = useQuery(['draft-list', workspace], () => {
    return drafts.list(workspace)
  })
  return {total: data?.length || 0, refetch, ids: data?.map(d => d.id) || []}
}
