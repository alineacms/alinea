import type {Auth} from 'alinea/core/Auth'
import {Client} from 'alinea/core/Client'
import {useDashboard} from 'alinea/dashboard/hook/UseDashboard'
import {useTranslation} from 'alinea/dashboard/hook/useTranslation'
import {Head} from 'alinea/dashboard/util/Head'
import {Button, HStack, px, Typo, VStack} from 'alinea/ui'
import {LogoShape} from 'alinea/ui/branding/LogoShape'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {IcRoundPublish} from 'alinea/ui/icons/IcRoundPublish'
import {Loader} from 'alinea/ui/Loader'
import {useQuery} from 'react-query'
import {type AuthResult, AuthResultType} from '../AuthResult.js'

export const copy = {
  title: 'Alinea',
  deploy: 'Ready to deploy?',
  handler: 'handler',
  continue: 'to continue',
  backend: 'Alinea requires a backend to continue.',
  customBackend: 'fully configure a custom backend',
  cloud: 'Or get set up in a few clicks with our cloud offering.',
  cloudButton: 'Continue with alinea.cloud'
}

export function CloudAuthView({setSession}: Auth.ViewProps) {
  const t = useTranslation(copy)
  const {client} = useDashboard()
  if (!(client instanceof Client))
    throw new Error('Cannot authenticate with non http client')
  const clientUrl = new URL(client.url, window.location.href)
  const {data, isError} = useQuery(
    ['auth.cloud'],
    () => {
      return fetch(new URL('?auth=status', clientUrl), {
        credentials: 'include'
      }).then<AuthResult>(res => res.json())
    },
    {keepPreviousData: true}
  )
  if (isError)
    return (
      <>
        <Head>
          <title>{t.title}</title>
        </Head>
        <div style={{display: 'flex', height: '100%', width: '100%'}}>
          <div style={{margin: 'auto', padding: px(20)}}>
            <VStack gap={20}>
              <HStack center gap={16}>
                <LogoShape>
                  <IcRoundPublish />
                </LogoShape>
                <Typo.H1 flat>{t.deploy}</Typo.H1>
              </HStack>
              <Typo.P>
                Alinea requires a{' '}
                <Typo.Link
                  href="https://alineacms.com/docs/deploy"
                  target="_blank"
                >
                  {t.handler}
                </Typo.Link>{' '}
                {t.continue}.
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
        async end() {
          location.href = new URL('?auth=logout', clientUrl).href
        }
      })
      return null
    case AuthResultType.UnAuthenticated:
      location.href =
        `${data.redirect}&from=${encodeURIComponent(
          `${location.protocol}//${location.host}${location.pathname}`
        )}`
      return null
    case AuthResultType.MissingApiKey:
      return (
        <>
          <Head>
            <title>{t.title}</title>
          </Head>
          <div style={{display: 'flex', height: '100%', width: '100%'}}>
            <div style={{margin: 'auto', padding: px(20)}}>
              <VStack gap={20}>
                <HStack center gap={16}>
                  <LogoShape>
                    <IcRoundPublish />
                  </LogoShape>
                  <Typo.H1 flat>{t.deploy}</Typo.H1>
                </HStack>
                <Typo.P>
                  {t.backend}
                  <br />
                  You can{' '}
                  <Typo.Link
                    href="https://alineacms.com/docs/deploy"
                    target="_blank"
                  >
                    <span>{t.customBackend}</span>
                  </Typo.Link>
                  .
                  <br />
                  {t.cloud}
                </Typo.P>
                <div>
                  <Button
                    as="a"
                    href={`${data.setupUrl}?from=${encodeURIComponent(
                      `${location.protocol}//${location.host}${location.pathname}`
                    )}`}
                    iconRight={IcRoundArrowForward}
                  >
                    {t.cloudButton}
                  </Button>
                </div>
              </VStack>
            </div>
          </div>
        </>
      )
  }
}
