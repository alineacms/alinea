import {Dashboard} from '@alinea/dashboard'
import {mySchema} from './schema'

const dashboard = new Dashboard({
  name: 'Alinea',
  schema: mySchema,
  apiUrl: 'http://localhost:4500',
  color: '#FFBD67'
  //auth: PasswordLessLogin
})

dashboard.render()
