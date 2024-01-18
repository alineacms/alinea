import {Button, HStack} from 'alinea/ui'
import * as Tabs from 'alinea/ui/Tabs'
import {UIStory} from 'alinea/ui/UIStory'

export function Buttons() {
  return (
    <UIStory>
      <HStack gap={16}>
        <Button outline>Cancel</Button>
        <Button>Confirm</Button>
      </HStack>
    </UIStory>
  )
}

export function TabsList() {
  return (
    <UIStory>
      <Tabs.Tabs>
        <Tabs.TabList aria-label="History of Ancient Rome">
          <Tabs.Tab>Founding of Rome</Tabs.Tab>
          <Tabs.Tab>Monarchy and Republic</Tabs.Tab>
          <Tabs.Tab>Empire</Tabs.Tab>
        </Tabs.TabList>
        <Tabs.TabPanel>
          Arma virumque cano, Troiae qui primus ab oris.
        </Tabs.TabPanel>
        <Tabs.TabPanel>Senatus Populusque Romanus.</Tabs.TabPanel>
        <Tabs.TabPanel>Alea jacta est.</Tabs.TabPanel>
      </Tabs.Tabs>
    </UIStory>
  )
}
