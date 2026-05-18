import {Icon, Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {EditFields} from '#/dashboard/app/Editor.js'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader
} from '#/dashboard/app/ui/Surface.js'
import {TabsSection} from '#/field/tabs.js'

interface TabsViewProps {
  section: Section
}

export function TabsView({section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  return (
    <Tabs>
      <Surface>
        <SurfaceHeader>
          <TabList>
            {visibleTypes.map((type, i) => {
              const {icon} = getType(type)
              return (
                <Tab key={i} id={i}>
                  {icon && <Icon icon={icon} />}
                  {Type.label(type)}
                </Tab>
              )
            })}
          </TabList>
        </SurfaceHeader>
        <SurfaceContent>
          {visibleTypes.map((type, i) => (
            <TabPanel key={i} id={i}>
              <EditFields fields={getType(type).fields} />
            </TabPanel>
          ))}
        </SurfaceContent>
      </Surface>
    </Tabs>
  )
}
