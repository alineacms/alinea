//import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import '@alinea/css/global.css'
import {BrowserPreview, renderDashboard} from '@alinea/dashboard'
import {schema} from '../../website/src/schema'

renderDashboard({
  name: 'Alinea',
  schema: schema,
  apiUrl: 'http://localhost:4500',
  color: '#6E57D0', // '#FFBD67', // '#6E57D0',
  // auth: PasswordLessLogin,
  preview(entry) {
    return <BrowserPreview url={`/api/preview?${entry.url}`} />
  }
})
