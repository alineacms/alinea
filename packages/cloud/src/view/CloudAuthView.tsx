import {Client} from '@alinea/client'
import {Auth} from '@alinea/core/Auth'
import {createError} from '@alinea/core/ErrorWithCode'
import {Hub} from '@alinea/core/Hub'
import {joinPaths} from '@alinea/core/util/Urls'
import {useDashboard} from '@alinea/dashboard'
import {Head} from '@alinea/dashboard/util/Head'
import {fetch} from '@alinea/iso'
import {Button, HStack, LogoShape, px, Typo, VStack} from '@alinea/ui'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import {IcRoundPublish} from '@alinea/ui/icons/IcRoundPublish'
import {useQuery} from 'react-query'
import {AuthResult, AuthResultType} from '../server/CloudAuthServer'

export function CloudAuthView({setSession}: Auth.ViewProps) {
  const {client} = useDashboard()
  if (!(client instanceof Client))
    throw createError(`Cannot authenticate with non http client`)
  const {data} = useQuery(
    ['auth.cloud'],
    () => {
      return fetch(joinPaths(client.url, Hub.routes.base, `/auth.cloud`), {
        credentials: 'include'
      }).then<AuthResult>(res => res.json())
    },
    {suspense: true}
  )
  const result = data!
  switch (result.type) {
    case AuthResultType.Authenticated:
      function logout() {
        console.log('redirect to logout url')
      }
      setSession({
        user: result.user,
        hub: client.authenticate(
          options => ({...options, credentials: 'same-origin'}),
          () => setSession(undefined)
        ),
        end: async () => logout()
      })
      return null
    case AuthResultType.UnAuthenticated:
      // window.location.href = result.redirect
      console.log('redirect to: ' + result.redirect)
      return null
    case AuthResultType.MissingApiKey:
      return (
        <>
          <Head>
            <title>Alinea</title>
          </Head>
          <div style={{display: 'flex', height: '100%', width: '100%'}}>
            <div style={{margin: 'auto', padding: px(20)}}>
              <VStack gap={20}>
                <HStack center gap={16}>
                  <LogoShape>
                    <IcRoundPublish />
                  </LogoShape>
                  <Typo.H1 flat>Ready to deploy?</Typo.H1>
                </HStack>
                <Typo.P>
                  Alinea requires a backend to continue.
                  <br />
                  You can{' '}
                  <Typo.Link
                    href="https://alinea.sh/docs/deploy/backends"
                    target="_blank"
                  >
                    <span>fully configure a custom backend</span>
                  </Typo.Link>
                  .
                  <br />
                  Or get set up in a few clicks with our cloud offering.
                </Typo.P>
                <div>
                  <Button
                    as="a"
                    href="https://alinea.cloud"
                    target="_blank"
                    iconRight={IcRoundArrowForward}
                  >
                    Continue with alinea.cloud
                  </Button>
                </div>
              </VStack>
            </div>
          </div>
        </>
      )
  }
}
