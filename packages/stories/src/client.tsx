import '@alinea/css'
import {renderDashboard} from '@alinea/dashboard'
import '@alinea/dashboard/global.css'
import {schema} from '../../website/src/schema'
import {PageView} from '../../website/src/view/PageView'

renderDashboard({
  name: 'Alinea',
  schema: schema,
  apiUrl: 'http://localhost:4500',
  color: '#FFBD67', //'#6E57D0'
  // auth: PasswordLessLogin,
  preview: PageView
})
