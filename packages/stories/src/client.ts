import {renderDashboard} from '@alinea/dashboard'
import {mySchema} from './schema'

renderDashboard({
  name: 'Alinea',
  schema: mySchema,
  apiUrl: 'http://localhost:4500',
  color: '#6E57D0' //'#FFBD67'
  //auth: PasswordLessLogin
})
