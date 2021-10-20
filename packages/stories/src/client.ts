import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import '@alinea/css'
import {renderDashboard} from '@alinea/dashboard'
import '@alinea/dashboard/global.css'
import {schema} from '../../website/src/schema'
import {Preview} from '../../website/src/view/Preview'

renderDashboard({
  name: 'Alinea',
  schema: schema,
  apiUrl: 'http://localhost:4500',
  color: '#FFBD67', //'#6E57D0'
  auth: PasswordLessLogin,
  preview: Preview
})
