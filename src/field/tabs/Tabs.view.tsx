import {
  Icon,
  Surface,
  SurfaceContent,
  SurfaceHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {EditFields} from '#/dashboard/app/EntryFields.js'
import {TabsSection} from '#/field/tabs.js'

interface TabsViewProps {
  section: Section
}

export function TabsView({section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  if (!visibleTypes.length) return null
  return (
    <Tabs defaultValue="0">
      <Surface>
        <SurfaceHeader>
          <TabsList>
            {visibleTypes.map((type, i) => {
              const {icon} = getType(type)
              return (
                <TabsTrigger key={i} value={String(i)}>
                  {icon && <Icon icon={icon} />}
                  {Type.label(type)}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </SurfaceHeader>
        <SurfaceContent>
          {visibleTypes.map((type, i) => (
            <TabsContent key={i} value={String(i)}>
              <EditFields fields={getType(type).fields} />
            </TabsContent>
          ))}
        </SurfaceContent>
      </Surface>
    </Tabs>
  )
}
