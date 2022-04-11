//import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Client} from '@alinea/client'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {config} from '../../website/.alinea/config'

renderDashboard({
  config,
  client: new Client(config, 'http://localhost:4500')
})
