import {useEntry, useGraphQuery, useUser} from 'alinea/dashboard'

export function CustomViewExample() {
  const entry = useEntry()
  const user = useUser()
  const siblingCount = useGraphQuery(({graph, entry}) => {
    if (!entry) return 0
    return graph.count({
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      status: 'preferDraft'
    })
  }, [])

  return (
    <section style={{display: 'grid', gap: 12}}>
      <h2 style={{fontSize: 18, margin: 0}}>Dashboard hook example</h2>
      <dl
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'max-content 1fr',
          margin: 0
        }}
      >
        <dt>Entry</dt>
        <dd>{entry?.title ?? 'No selected entry'}</dd>
        <dt>Status</dt>
        <dd>{entry?.status ?? '-'}</dd>
        <dt>Locale</dt>
        <dd>{entry?.locale ?? 'default'}</dd>
        <dt>User</dt>
        <dd>{user?.name ?? 'Anonymous'}</dd>
        <dt>Siblings</dt>
        <dd>{siblingCount}</dd>
      </dl>
    </section>
  )
}
