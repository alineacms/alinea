import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import '@alinea/css'
import {renderDashboard} from '@alinea/dashboard'
import '@alinea/dashboard/global.css'
import {schema} from '../../website/src/schema'

renderDashboard({
  name: 'Alinea',
  schema: schema,
  apiUrl: 'http://localhost:4500',
  color: '#FF5C00', // '#FFBD67', //'#6E57D0'
  auth: PasswordLessLogin
})
