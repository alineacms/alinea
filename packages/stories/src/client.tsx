//import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {config} from '../../website/alinea.config'

renderDashboard({
  config,
  apiUrl: 'http://localhost:4500'
})
