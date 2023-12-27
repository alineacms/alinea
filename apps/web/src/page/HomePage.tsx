import heroBg from '@/assets/hero.jpg'
import {cms} from '@/cms'
import {
  IcRoundFastForward,
  MdiLanguageTypescript,
  MdiSourceBranch
} from '@/icons'
import {Feature, Features} from '@/layout/Features'
import {Hero} from '@/layout/Hero'
import {LayoutContainer} from '@/layout/Layout'
import {WebText} from '@/layout/WebText'
import {WebTypo} from '@/layout/WebTypo'
import {Newsletter} from '@/layout/engage/Newsletter'
import {Home} from '@/schema/Home'
import {HStack, VStack} from 'alinea/ui/Stack'
import {fromModule} from 'alinea/ui/util/Styler'
import {px} from 'alinea/ui/util/Units'
import css from './HomePage.module.scss'

const styles = fromModule(css)

export async function generateMetadata() {
  const home = await cms.get(Home())
  return {title: home.metadata?.title || home.title}
}

export default async function HomePage() {
  const home = await cms.get(Home())
  return (
    <main className={styles.home()}>
      <div
        className={styles.hero()}
        style={{backgroundImage: `url(${heroBg.src})`}}
      >
        <Hero>
          <LayoutContainer>
            <VStack center>
              <Hero.Title>{home.headline}</Hero.Title>
              <Hero.ByLine>{home.byline}</Hero.ByLine>
              <HStack
                wrap
                center
                gap={24}
                justify="center"
                style={{paddingTop: px(20)}}
              >
                {home.action?.url && (
                  <Hero.Action href={home.action.url}>
                    {home.action.label}
                  </Hero.Action>
                )}
                {/*<WebTypo.Link
                  className={styles.hero.demo()}
                  href="https://demo.alinea.sh"
                  target="_blank"
                >
                  <div>
                    <span>Try the demo</span>
                  </div>
                </WebTypo.Link>*/}
              </HStack>
            </VStack>
          </LayoutContainer>
        </Hero>
      </div>

      <section className={styles.home.features()}>
        <Features>
          <Feature icon={MdiSourceBranch}>
            <WebTypo>
              <Feature.Title>Git based</Feature.Title>
              <WebTypo.P className={styles.home.features.desc()}>
                Content is version controlled in git. Easily branch and feature
                test content changes.
              </WebTypo.P>
            </WebTypo>
          </Feature>
          <Feature icon={MdiLanguageTypescript}>
            <WebTypo>
              <Feature.Title>Fully typed</Feature.Title>
              <WebTypo.P className={styles.home.features.desc()}>
                Typescript users get a type-safe experience.
              </WebTypo.P>
            </WebTypo>
          </Feature>
          <Feature icon={IcRoundFastForward}>
            <WebTypo>
              <Feature.Title>Zero latency</Feature.Title>
              <WebTypo.P className={styles.home.features.desc()}>
                Content is easily queryable through an in-memory SQLite
                database, avoiding network overhead.
              </WebTypo.P>
            </WebTypo>
          </Feature>
        </Features>
      </section>

      <section className={styles.home.section('highlight')}>
        <LayoutContainer>
          <div className={styles.home.intro()}>
            <WebText doc={home.introduction.text} />
            <div className={styles.home.intro.code()}>
              {/*<CodeVariantsBlock variants={props.introduction.code} />
              <HStack center>
                <Stack.Right className={styles.home.intro.examples()}>
                  <HStack gap={25}>
                    <svg style={{width: px(60)}} viewBox="0 0 394 80">
                      <path
                        d="M261.919 0.0330722H330.547V12.7H303.323V79.339H289.71V12.7H261.919V0.0330722Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M149.052 0.0330722V12.7H94.0421V33.0772H138.281V45.7441H94.0421V66.6721H149.052V79.339H80.43V12.7H80.4243V0.0330722H149.052Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M183.32 0.0661486H165.506L229.312 79.3721H247.178L215.271 39.7464L247.127 0.126654L229.312 0.154184L206.352 28.6697L183.32 0.0661486Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M201.6 56.7148L192.679 45.6229L165.455 79.4326H183.32L201.6 56.7148Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M80.907 79.339L17.0151 0H0V79.3059H13.6121V16.9516L63.8067 79.339H80.907Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M333.607 78.8546C332.61 78.8546 331.762 78.5093 331.052 77.8186C330.342 77.1279 329.991 76.2917 330 75.3011C329.991 74.3377 330.342 73.5106 331.052 72.8199C331.762 72.1292 332.61 71.7838 333.607 71.7838C334.566 71.7838 335.405 72.1292 336.115 72.8199C336.835 73.5106 337.194 74.3377 337.204 75.3011C337.194 75.9554 337.028 76.5552 336.696 77.0914C336.355 77.6368 335.922 78.064 335.377 78.373C334.842 78.6911 334.252 78.8546 333.607 78.8546Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M356.84 45.4453H362.872V68.6846C362.863 70.8204 362.401 72.6472 361.498 74.1832C360.585 75.7191 359.321 76.8914 357.698 77.7185C356.084 78.5364 354.193 78.9546 352.044 78.9546C350.079 78.9546 348.318 78.6001 346.75 77.9094C345.182 77.2187 343.937 76.1826 343.024 74.8193C342.101 73.456 341.649 71.7565 341.649 69.7207H347.691C347.7 70.6114 347.903 71.3838 348.29 72.0291C348.677 72.6744 349.212 73.1651 349.895 73.5105C350.586 73.8559 351.38 74.0286 352.274 74.0286C353.243 74.0286 354.073 73.8286 354.746 73.4196C355.419 73.0197 355.936 72.4199 356.296 71.6201C356.646 70.8295 356.831 69.8479 356.84 68.6846V45.4453Z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M387.691 54.5338C387.544 53.1251 386.898 52.0254 385.773 51.2438C384.638 50.4531 383.172 50.0623 381.373 50.0623C380.11 50.0623 379.022 50.2532 378.118 50.6258C377.214 51.0075 376.513 51.5164 376.033 52.1617C375.554 52.807 375.314 53.5432 375.295 54.3703C375.295 55.061 375.461 55.6608 375.784 56.1607C376.107 56.6696 376.54 57.0968 377.103 57.4422C377.656 57.7966 378.274 58.0874 378.948 58.3237C379.63 58.56 380.313 58.76 380.995 58.9236L384.14 59.6961C385.404 59.9869 386.631 60.3778 387.802 60.8776C388.973 61.3684 390.034 61.9955 390.965 62.7498C391.897 63.5042 392.635 64.413 393.179 65.4764C393.723 66.5397 394 67.7848 394 69.2208C394 71.1566 393.502 72.8562 392.496 74.3285C391.491 75.7917 390.043 76.9369 388.143 77.764C386.252 78.582 383.965 79 381.272 79C378.671 79 376.402 78.6002 374.493 77.8004C372.575 77.0097 371.08 75.8463 370.001 74.3194C368.922 72.7926 368.341 70.9294 368.258 68.7391H374.235C374.318 69.8842 374.687 70.8386 375.314 71.6111C375.95 72.3745 376.78 72.938 377.795 73.3197C378.819 73.6923 379.962 73.8832 381.226 73.8832C382.545 73.8832 383.707 73.6832 384.712 73.2924C385.708 72.9016 386.492 72.3564 387.055 71.6475C387.627 70.9476 387.913 70.1206 387.922 69.1754C387.913 68.312 387.654 67.5939 387.156 67.0304C386.649 66.467 385.948 65.9944 385.053 65.6127C384.15 65.231 383.098 64.8856 381.899 64.5857L378.081 63.6223C375.323 62.9225 373.137 61.8592 371.541 60.4323C369.937 59.0054 369.143 57.115 369.143 54.7429C369.143 52.798 369.678 51.0894 370.758 49.6261C371.827 48.1629 373.294 47.0268 375.148 46.2179C377.011 45.4 379.114 45 381.456 45C383.836 45 385.92 45.4 387.719 46.2179C389.517 47.0268 390.929 48.1538 391.952 49.5897C392.976 51.0257 393.511 52.6707 393.539 54.5338H387.691Z"
                        fill="currentColor"
                      ></path>
                    </svg>

                    <svg style={{width: px(55)}} viewBox="0 0 745 186">
                      <path
                        d="M151.744 141.947C153.387 163.214 153.387 173.183 153.387 184.065H104.558C104.558 181.694 104.6 179.526 104.642 177.327C104.774 170.492 104.912 163.365 103.813 148.971C102.361 127.899 93.356 123.216 76.798 123.216H62.128H0V84.876H79.122C100.037 84.876 110.494 78.464 110.494 61.489C110.494 46.563 100.037 37.517 79.122 37.517H0V0H87.836C135.186 0 158.716 22.536 158.716 58.535C158.716 85.461 142.158 103.021 119.79 105.948C138.672 109.753 149.71 120.582 151.744 141.947Z"
                        fill="currentColor"
                      />
                      <path
                        d="M0 184.065V155.483H51.63C60.254 155.483 62.126 161.929 62.126 165.772V184.065H0Z"
                        fill="currentColor"
                      />
                      <path
                        d="M740.943 55.524H692.548L670.523 86.474L649.079 55.524H597.206L643.862 119.467L593.148 185.745H641.544L667.336 150.416L693.127 185.745H745L693.996 117.423L740.943 55.524Z"
                        fill="currentColor"
                      />
                      <path
                        d="M436.111 77.105C430.604 61.922 418.723 51.411 395.829 51.411C376.413 51.411 362.503 60.171 355.548 74.477V54.915H308.602V185.135H355.548V121.193C355.548 101.631 361.054 88.784 376.413 88.784C390.613 88.784 394.091 98.127 394.091 115.938V185.135H441.037V121.193C441.037 101.631 446.253 88.784 461.902 88.784C476.102 88.784 479.29 98.127 479.29 115.938V185.135H526.236V103.383C526.236 76.229 515.804 51.411 480.159 51.411C458.425 51.411 443.066 62.506 436.111 77.105Z"
                        fill="currentColor"
                      />
                      <path
                        d="M259.716 134.599C255.369 144.818 247.255 149.197 234.504 149.197C220.304 149.197 208.712 141.606 207.553 125.547H298.258V112.409C298.258 77.08 275.365 47.298 232.185 47.298C191.904 47.298 161.766 76.788 161.766 117.956C161.766 159.416 191.325 184.526 232.765 184.526C266.961 184.526 290.724 167.884 297.389 138.102L259.716 134.599ZM208.133 102.773C209.871 90.51 216.537 81.167 231.606 81.167C245.516 81.167 253.05 91.094 253.63 102.773H208.133Z"
                        fill="currentColor"
                      />
                      <path
                        d="M541.592 55.78V186H588.538V55.78H541.592ZM541.302 43.517H588.828V2.056H541.302V43.517Z"
                        fill="currentColor"
                      />
                    </svg>

                    <WebTypo.Link
                      href="https://github.com/alineacms/alinea/tree/main/examples"
                      target="_blank"
                    >
                      <HStack center gap={8}>
                        <span>Browse example starters</span>
                        <IcRoundOpenInNew />
                      </HStack>
                    </WebTypo.Link>
                  </HStack>
                </Stack.Right>
              </HStack>*/}
            </div>
          </div>
        </LayoutContainer>
      </section>

      <section className={styles.home.section()}>
        <VStack gap={50}>
          <LayoutContainer>
            <WebTypo>
              <WebTypo.H2>User friendly dashboard</WebTypo.H2>
              <WebTypo.P>
                Content can be navigated hierarchically, much like the website
                you&apos;re structuring, making it easy to find what you&apos;re
                looking for. A live preview of the page shows exactly what
                changes look like.
              </WebTypo.P>
            </WebTypo>
          </LayoutContainer>
          {/*<div className={styles.home.demo()}>
            <iframe
              src="https://demo.alinea.sh"
              className={styles.home.demo.inner()}
            />
          </div>*/}
        </VStack>
      </section>

      <section className={styles.home.section('highlight')}>
        <LayoutContainer>
          <HStack gap={30} wrap center>
            <VStack align="flex-start" gap={30} style={{flexGrow: 1}}>
              <WebTypo>
                <WebTypo.H2>Build with us</WebTypo.H2>
                <WebTypo.P>
                  Alinea is open source under the MIT license.
                </WebTypo.P>
              </WebTypo>
              <Hero.Action
                href="https://github.com/alineacms/alinea"
                // target="_blank"
              >
                Fork on Github
              </Hero.Action>
            </VStack>
            <Newsletter style={{flexGrow: 1}} />
          </HStack>
        </LayoutContainer>
      </section>

      {/*

        I think below we should highlight in separate (interactive) sections:
        - [x] config as code => preview how to build a schema
        - [x] live previews
        - [x] query engine
        - [ ] custom fields
        - [ ] the editing/dashboard experience
        - [ ] deploy "anywhere": node or edge deploys

      

      <section className={styles.home.section()}>
        <Layout.Container>
          <WebTypo.H2>Code your schema</WebTypo.H2>
          <WebTypo.P>
            Configuration as code saves you from clicking endlessly through a UI
            to define fields. Easily branch and feature test schema changes.
          </WebTypo.P>
        </Layout.Container>
      </section>

      <section className={styles.home.section()}>
        <Layout.Container>
          <WebTypo.H2>Live previews</WebTypo.H2>
          <WebTypo.P>
            React to dashboard changes by previewing a live page view.
          </WebTypo.P>
        </Layout.Container>
      </section>

      <section className={styles.home.section()}>
        <Layout.Container>
          <WebTypo.H2>Query content</WebTypo.H2>
          <WebTypo.P>
            Use an ORM like API to query field contents. Content is bundled with
            your code and directly available without network roundtrips.
          </WebTypo.P>
        </Layout.Container>
      </section>

      <section className={styles.home.section()}>
        <Layout.Container>
          <WebTypo.H2>Works with any framework</WebTypo.H2>
          <WebTypo.P>Pick your favorite and get started.</WebTypo.P>
        </Layout.Container>
      </section>

      <section className={styles.home.section()}>
        <Layout.Container>
          <WebTypo.H2>Powerful fields</WebTypo.H2>
          <WebTypo.P>
            Alinea ships with a comprehensive set of fields that allow you to
            structure complex web apps.
          </WebTypo.P>
        </Layout.Container>
      </section>*/}
    </main>
  )
}
