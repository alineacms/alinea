import styler from '@alinea/styler'
import {
  IcOutlineSettings,
  IcRoundArchive,
  IcRoundLanguage,
  IcRoundPublic,
  LucideFile,
  LucideFolder
} from '#/dashboard/icons.js'
import {AppShell, AppShellContent, AppShellInner} from './AppShell.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {Checkbox} from './Checkbox.js'
import {Field} from './Field.js'
import {
  Navigation,
  NavigationHeading,
  NavigationItem,
  NavigationSection
} from './Navigation.js'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderMain,
  PageHeaderTitle,
  PageHeaderTools
} from './PageHeader.js'
import {Rail, RailBody, RailHeader} from './Rail.js'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader,
  SurfaceTitle
} from './Surface.js'
import {Toolbar, ToolbarGroup, ToolbarSeparator} from './Toolbar.js'
import css from './EntryPage.module.css'

const styles = styler(css)

export function EntryPage() {
  return (
    <AppShell>
      <AppShellInner>
        <AppShellContent>
          <Rail width={260}>
            <RailHeader>
              <div className={styles['alinea-EntryPage-sidebarHeader']()}>
                <span className={styles['alinea-EntryPage-sidebarTitle']()}>
                  Editorial
                </span>
                <Button
                  appearance="plain"
                  aria-label="Workspace settings"
                  size="icon-small"
                >
                  <IcOutlineSettings />
                </Button>
              </div>
            </RailHeader>
            <RailBody>
              <Navigation label="Content">
                <NavigationSection>
                  <NavigationHeading>Content</NavigationHeading>
                  <NavigationItem icon={<IcRoundPublic />} label="Pages" />
                  <NavigationItem
                    depth={1}
                    icon={<LucideFile />}
                    label="Home"
                  />
                  <NavigationItem
                    depth={1}
                    icon={<LucideFile />}
                    label="About us"
                    selected
                  />
                  <NavigationItem
                    depth={1}
                    icon={<LucideFolder />}
                    label="News"
                    meta="3"
                  />
                </NavigationSection>
                <NavigationSection>
                  <NavigationHeading>Workspace</NavigationHeading>
                  <NavigationItem icon={<IcRoundLanguage />} label="Locales" />
                  <NavigationItem icon={<IcRoundArchive />} label="Archive" />
                </NavigationSection>
              </Navigation>
            </RailBody>
          </Rail>
          <Rail main>
            <PageHeader>
              <PageHeaderMain>
                <div className={styles['alinea-EntryPage-headerTitle']()}>
                  <PageHeaderTitle>About us</PageHeaderTitle>
                  <Badge size="small" status="draft">
                    Draft
                  </Badge>
                </div>
              </PageHeaderMain>
              <PageHeaderTools>
                <Toolbar label="Entry view">
                  <ToolbarGroup>
                    <Button appearance="plain" size="small">
                      Overview
                    </Button>
                    <Button appearance="active" size="small">
                      Edit
                    </Button>
                  </ToolbarGroup>
                  <ToolbarSeparator />
                  <ToolbarGroup>
                    <Button appearance="plain" size="small">
                      Preview
                    </Button>
                  </ToolbarGroup>
                </Toolbar>
                <PageHeaderActions>
                  <Button intent="secondary">Save draft</Button>
                  <Button intent="primary">Publish</Button>
                </PageHeaderActions>
              </PageHeaderTools>
            </PageHeader>
            <div className={styles['alinea-EntryPage-body']()}>
              <div className={styles['alinea-EntryPage-fields']()}>
                <Surface>
                  <SurfaceHeader>
                    <SurfaceTitle>Content</SurfaceTitle>
                  </SurfaceHeader>
                  <SurfaceContent>
                    <div className={styles['alinea-EntryPage-fieldGrid']()}>
                      <div className={styles['alinea-EntryPage-fieldWide']()}>
                        <Field defaultValue="About us" label="Title" />
                      </div>
                      <div className={styles['alinea-EntryPage-fieldNarrow']()}>
                        <Field defaultValue="/about" label="Path" />
                      </div>
                      <div className={styles['alinea-EntryPage-fieldFull']()}>
                        <Field
                          defaultValue="We build thoughtful tools for structured content."
                          description="Used on cards and in search results."
                          label="Summary"
                          multiline
                          rows={3}
                        />
                      </div>
                      <div className={styles['alinea-EntryPage-fieldFull']()}>
                        <Field
                          defaultValue="Alinea gives teams a calm, focused place to shape and publish content. This page explains the people and principles behind the product."
                          label="Body"
                          multiline
                          rows={8}
                        />
                      </div>
                    </div>
                  </SurfaceContent>
                </Surface>
                <Surface>
                  <SurfaceHeader>
                    <SurfaceTitle>Publishing</SurfaceTitle>
                  </SurfaceHeader>
                  <SurfaceContent>
                    <div className={styles['alinea-EntryPage-sectionIntro']()}>
                      <h2 className={styles['alinea-EntryPage-sectionTitle']()}>
                        Visibility
                      </h2>
                      <p
                        className={styles[
                          'alinea-EntryPage-sectionDescription'
                        ]()}
                      >
                        Control where this entry appears after publishing.
                      </p>
                    </div>
                    <Checkbox
                      defaultSelected
                      description="Show this page in the primary navigation."
                      label="Include in navigation"
                    />
                    <Checkbox
                      defaultSelected
                      label="Allow search engines to index this page"
                    />
                    <Surface>
                      <SurfaceContent>
                        <Field
                          defaultValue="About Alinea"
                          label="Search title"
                          placeholder="Defaults to the entry title"
                        />
                        <Field
                          defaultValue="Learn about the team and principles behind Alinea."
                          label="Search description"
                          multiline
                          rows={3}
                        />
                      </SurfaceContent>
                    </Surface>
                  </SurfaceContent>
                </Surface>
              </div>
            </div>
            <footer className={styles['alinea-EntryPage-footer']()}>
              <span>English · Last saved a moment ago</span>
              <span>Entry ID: about</span>
            </footer>
          </Rail>
        </AppShellContent>
      </AppShellInner>
    </AppShell>
  )
}
