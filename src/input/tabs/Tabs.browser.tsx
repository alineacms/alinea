import {Section, Type} from 'alinea/core'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, TextLabel} from 'alinea/ui'
import {Lift, LiftHeader} from 'alinea/ui/Lift'
import {Sink} from 'alinea/ui/Sink'
import * as Tabs from 'alinea/ui/Tabs'
import {useElevation} from 'alinea/ui/util/Elevation'
import {useId} from 'react'
import {TabsSection, tabs as createTabs} from './Tabs.js'

export * from './Tabs.js'

// Todo: fix type here
export const tabs = Section.provideView(TabsView, createTabs as any)

interface TabsViewProps {
  section: Section
}

export interface TabsHeaderProps {
  id: string
  section: Section
  backdrop?: boolean
}

export function TabsHeader({id, section, backdrop = true}: TabsHeaderProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.meta(type).isHidden)
  if (!visibleTypes.length) return null
  const list = (
    <Tabs.TabList>
      {visibleTypes.map((type, i) => {
        const meta = Type.meta(type)
        const Icon = meta.icon
        return (
          <Tabs.Tab key={i} id={`${id}+${i}`}>
            <HStack center gap={8}>
              {Icon && <Icon />}
              <TextLabel label={Type.label(type)} />
            </HStack>
          </Tabs.Tab>
        )
      })}
    </Tabs.TabList>
  )
  return backdrop ? <LiftHeader>{list}</LiftHeader> : list
}

function TabsView({section}: TabsViewProps) {
  const id = useId()
  const {parent} = useElevation()
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.meta(type).isHidden)
  if (!visibleTypes.length) return null
  const inner = (
    <Tabs.Tabs>
      <TabsHeader id={id} section={section} />
      <Lift>
        {visibleTypes.map((type, i) => {
          return (
            <Tabs.TabPanel shouldForceMount key={i} id={`${id}+${i}`}>
              {({isInert}) => (
                <div
                  aria-hidden={isInert ? 'true' : undefined}
                  style={{display: isInert ? 'none' : undefined}}
                >
                  <InputForm type={type} border={false} />
                </div>
              )}
            </Tabs.TabPanel>
          )
        })}
      </Lift>
    </Tabs.Tabs>
  )
  return (
    <div>
      {parent === 'lift' ? (
        <InputLabel inline>
          <Sink.Root>
            <Sink.Content>{inner}</Sink.Content>
          </Sink.Root>
        </InputLabel>
      ) : (
        inner
      )}
    </div>
  )
}
