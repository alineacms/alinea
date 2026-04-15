import type {Auth} from '#/core/Auth.js'
import {Client} from '#/core/Client.js'
import {useDashboard} from '#/dashboard/hook/UseDashboard.js'
import {Head} from '#/dashboard/util/Head.js'
import {Button, HStack, px, Typo, VStack} from '#/ui.js'
import {LogoShape} from '#/ui/branding/LogoShape.js'
import {IcRoundArrowForward} from '#/ui/icons/IcRoundArrowForward.js'
import {IcRoundPublish} from '#/ui/icons/IcRoundPublish.js'
import {Loader} from '#/ui/Loader.js'
import {useQuery} from 'react-query'
import {AuthResultType} from '../AuthResult.js'

export function CloudAuthView({setSession}: Auth.ViewProps) {
  const {client} = useDashboard()
  if (!(client instanceof Client))
    throw new Error('Cannot authenticate with non http client')
  const clientUrl = new URL(client.url, window.location.href)
  const {data, isError} = useQuery(['auth.status'], () => client.authStatus(), {
    cacheTime: 0,
    keepPreviousData: false
  })
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
                  href="https://alineacms.com/docs/deploy"
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
    case AuthResultType.NeedsRefresh:
      throw new Error('Authentication failure, please refresh the page')
    case AuthResultType.Authenticated:
      setSession({
        user: data.user,
        cnx: client.authenticate(
          options => options,
          () => setSession(undefined)
        )
      })
      return null
    case AuthResultType.UnAuthenticated:
      location.href = `${data.redirect}&from=${encodeURIComponent(
        `${location.protocol}//${location.host}${location.pathname}`
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
                    href="https://alineacms.com/docs/deploy"
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
                      `${location.protocol}//${location.host}${location.pathname}`
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
