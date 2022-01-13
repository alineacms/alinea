//import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import '@alinea/css'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {schema} from '../../website/src/schema'
import {PageView} from '../../website/src/view/PageView'

renderDashboard({
  name: 'Alinea',
  schema: schema,
  apiUrl: 'http://localhost:4500',
  color: '#FFBD67', // '#6E57D0',
  // auth: PasswordLessLogin,
  preview: PageView
})
