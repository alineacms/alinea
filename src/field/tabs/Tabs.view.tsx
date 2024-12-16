import {getType} from 'alinea/core/Internal'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, TextLabel} from 'alinea/ui'
import {Lift, LiftHeader} from 'alinea/ui/Lift'
import {Sink} from 'alinea/ui/Sink'
import * as Tabs from 'alinea/ui/Tabs'
import {useElevation} from 'alinea/ui/util/Elevation'
import {useId} from 'react'
import {TabsSection} from './Tabs.js'

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
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  const list = (
    <Tabs.TabList>
      {visibleTypes.map((type, i) => {
        const {icon: Icon} = getType(type)
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

export function TabsView({section}: TabsViewProps) {
  const id = useId()
  const {parent} = useElevation()
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  const inner = (
    <Tabs.Tabs>
      <TabsHeader id={id} section={section} />
      <Lift>
        <Tabs.TabPanels>
          {visibleTypes.map((type, i) => {
            return (
              <Tabs.TabPanel key={i} id={`${id}+${i}`}>
                <InputForm type={type} border={false} />
              </Tabs.TabPanel>
            )
          })}
        </Tabs.TabPanels>
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
