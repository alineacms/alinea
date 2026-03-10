import type {Config} from 'alinea/core/Config'
import {Provider, createStore} from 'jotai'
import {useState} from 'react'
import {configAtom} from '../atoms/config.js'
import {useRequiredAtoms} from '../atoms/util/RequiredAtom.js'
import {cms} from '../fixture/cms.js'
import {SidebarTree} from './SidebarTree.js'

const requiredAtoms = {
  config: configAtom
}

interface SidebarTreeStoryProps {
  config?: Config
}

interface SidebarTreeStoryInnerProps {
  config: Config
}

export function SidebarTreeStory({
  config = cms.config
}: SidebarTreeStoryProps) {
  const [store] = useState(createStore)
  return (
    <Provider store={store}>
      <SidebarTreeStoryInner config={config} />
    </Provider>
  )
}

function SidebarTreeStoryInner({config}: SidebarTreeStoryInnerProps) {
  useRequiredAtoms(requiredAtoms, {config})
  return <SidebarTree />
}
