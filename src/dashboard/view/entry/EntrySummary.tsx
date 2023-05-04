import {Entry, Tree, Type, view} from 'alinea/core'
import {Collection} from 'alinea/store'
import {
  Chip,
  Ellipsis,
  HStack,
  TextLabel,
  Typo,
  VStack,
  fromModule
} from 'alinea/ui'
import {Link} from 'alinea/ui/Link'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {ReactNode} from 'react'
import {useDashboard} from '../../hook/UseDashboard.js'
import {useNav} from '../../hook/UseNav.js'
import css from './EntrySummary.module.scss'

const styles = fromModule(css)

function entrySummaryQuery(Entry: Collection<Entry>) {
  return {
    id: Entry.id,
    type: Entry.type,
    workspace: Entry.alinea.workspace,
    root: Entry.alinea.root,
    title: Entry.title,
    parents: Tree.parents(Entry.id).select(parent => ({title: parent.title}))
  }
}

export const EntrySummaryRow = view(
  entrySummaryQuery,
  function EntrySummaryRow({id, title, type: typeName, parents}) {
    const nav = useNav()
    const {schema} = useDashboard().config
    const type = schema[typeName]
    if (!type) return null
    return (
      <HStack center full gap={10} className={styles.row()}>
        <VStack>
          {parents.length > 0 && (
            <Ellipsis>
              <Typo.Small>
                <HStack center gap={3}>
                  {parents
                    .map<ReactNode>(({title}, i) => (
                      <TextLabel key={i} label={title} />
                    ))
                    .reduce((prev, curr, i) => [
                      prev,
                      <IcRoundKeyboardArrowRight key={`s${i}`} />,
                      curr
                    ])}
                </HStack>
              </Typo.Small>
            </Ellipsis>
          )}
          <Ellipsis>
            <Link href={nav.entry({id})}>
              <TextLabel label={title} />
            </Link>
          </Ellipsis>
        </VStack>
        <Chip style={{marginLeft: 'auto'}}>
          <TextLabel label={Type.label(type)} />
        </Chip>
      </HStack>
    )
  }
)

export const EntrySummaryThumb = view(
  entrySummaryQuery,
  function EntrySummaryThumb({id, title, type: typeName, parents}) {
    const {schema} = useDashboard().config
    const type = schema[typeName]!
    return (
      <div className={styles.thumb()}>
        {parents.length > 0 && (
          <header className={styles.thumb.header()}>
            <Typo.Small>
              <HStack center gap={3}>
                {parents
                  .map<ReactNode>(({title}, i) => (
                    <TextLabel key={i} label={title} />
                  ))
                  .reduce((prev, curr, i) => [
                    prev,
                    <IcRoundKeyboardArrowRight key={`s${i}`} />,
                    curr
                  ])}
              </HStack>
            </Typo.Small>
          </header>
        )}
        <div className={styles.thumb.title()}>
          <TextLabel label={title} />
        </div>
        <div className={styles.thumb.footer()}>
          <Chip style={{marginLeft: 'auto'}}>
            <TextLabel label={Type.label(type)} />
          </Chip>
        </div>
      </div>
    )
  }
)
