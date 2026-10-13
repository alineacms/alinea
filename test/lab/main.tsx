// The lab page of the website, without the rest of the website
import './world/mainRealm.js'
import '../../apps/web/src/global.scss'
import {createRoot} from 'react-dom/client'
import {Lab} from '../../apps/web/src/page/lab/Lab.js'
import {engine, start} from './engine.js'

const root = document.getElementById('root')!
root.style.padding = '24px'
await start()
createRoot(root).render(<Lab engine={engine} />)
