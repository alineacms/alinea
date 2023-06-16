import {Connection} from 'alinea/core'
import {Auth} from 'alinea/core/Auth'
import {Client} from 'alinea/core/Client'
import {ErrorWithCode} from 'alinea/core/ErrorWithCode'
import {joinPaths} from 'alinea/core/util/Urls'
import {useDashboard} from 'alinea/dashboard'
import {Head} from 'alinea/dashboard/util/Head'
import {Button, HStack, px, Typo, VStack} from 'alinea/ui'
import {LogoShape} from 'alinea/ui/branding/LogoShape'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {Loader} from 'alinea/ui/Loader'
import {useQuery} from 'react-query'
import {AuthResult, AuthResultType} from '../AuthResult.js'

export function CloudAuthView({setSession}: Auth.ViewProps) {
  const {client} = useDashboard()
  if (!(client instanceof Client))
    throw new ErrorWithCode(`Cannot authenticate with non http client`)
  const {data, isError} = useQuery(
    ['auth.cloud'],
    () => {
      return fetch(
        joinPaths(client.options.url, Connection.routes.base, `/auth.cloud`),
        {
          credentials: 'include'
        }
      ).then<AuthResult>(res => res.json())
    },
    {keepPreviousData: true}
  )
  if (isError)
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
                Alinea requires a{' '}
                <Typo.Link
                  href="https://alinea.sh/docs/deploy/exporting-the-dashboard"
                  target="_blank"
                >
                  handler
                </Typo.Link>{' '}
                to continue.
              </Typo.P>
            </VStack>
          </div>
        </div>
      </>
    )
  if (!data) return <Loader absolute />
  const {location} = window
  switch (data.type) {
    case AuthResultType.Authenticated:
      setSession({
        user: data.user,
        cnx: client.authenticate(
          options => ({...options, credentials: 'same-origin'}),
          () => setSession(undefined)
        ),
        end: async () => {
          location.href = joinPaths(
            client.options.url,
            Connection.routes.base,
            `/auth/logout`
          )
        }
      })
      return null
    case AuthResultType.UnAuthenticated:
      location.href =
        data.redirect +
        `&from=${encodeURIComponent(
          location.protocol + '//' + location.host + location.pathname
        )}`
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
                    href="https://alinea.sh/docs/deploy/intro"
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
                    href={`${data.setupUrl}?from=${encodeURIComponent(
                      location.protocol +
                        '//' +
                        location.host +
                        location.pathname
                    )}`}
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
