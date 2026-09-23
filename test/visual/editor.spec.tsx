import {routes} from './support/VisualRoutes.js'
import {FixtureScenarioMount} from './support/VisualScenarioMount.js'
import {expect, test, themed} from './support/VisualTest.js'

function editorTests() {
  test('entry editor', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.shot('entry-clean')
  })

  test('entry editor with a draft', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.statusUpdated,
      title: 'Updated draft'
    })
    await app.shot('entry-draft')
  })
}

themed(() => {
  editorTests()

  test('entry editor with changes', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.about,
      title: 'About'
    })
    await app.page
      .getByRole('textbox', {name: 'Title', exact: true})
      .fill('About us')
    await expect(
      app.page.getByRole('button', {name: 'Discard my changes'})
    ).toBeVisible()
    await app.page.mouse.move(640, 790)
    await app.shot('entry-dirty')
  })

  test('published entry', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.statusLive,
      title: 'Live'
    })
    await app.shot('entry-published')
  })

  test('draft only entry', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.statusDraftOnly,
      title: 'Draft only'
    })
    await app.shot('entry-draft-only')
  })

  test('archived entry', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.statusArchived,
      title: 'Archived only'
    })
    await app.shot('entry-archived')
  })

  test('untranslated entry', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.i18n,
      ready: page => page.getByRole('row', {name: 'About', exact: true})
    })
    await app.page.getByRole('row', {name: 'About', exact: true}).click()
    await expect(app.page.getByRole('heading', {level: 1})).toHaveText('About')
    await app.page.getByRole('button', {name: 'Language', exact: true}).click()
    await app.page.getByRole('menuitemradio', {name: /^DE/}).click()
    await expect(
      app.page.getByRole('button', {name: 'Language', exact: true})
    ).toContainText('DE')
    await app.settle()
    await app.shot('entry-untranslated')
  })

  test('more actions menu', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.statusUpdated,
      title: 'Updated draft'
    })
    await app.page.getByRole('button', {name: 'More actions'}).click()
    await expect(app.page.getByRole('menu')).toBeVisible()
    await app.shot('entry-more-actions')
  })

  test('entry sidebar history', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('tab', {name: 'History'}).click()
    await expect(
      app.page.getByRole('button', {name: 'Previous versions'})
    ).toHaveAttribute('aria-expanded', 'true')
    await app.shot('sidebar-history')
  })

  test('entry sidebar references', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.helloWorld,
      title: 'Hello world'
    })
    await app.page.getByRole('tab', {name: 'References'}).click()
    await expect(
      app.page.getByRole('tabpanel', {name: 'References'})
    ).toContainText('Home')
    await app.shot('sidebar-references')
  })

  test('create entry modal', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('button', {name: 'Create new'}).click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('create-entry')
  })

  test('entry not found', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.notFound,
      title: 'Entry not found'
    })
    await app.shot('entry-not-found')
  })
})

test.describe('mobile', () => {
  test.use({viewport: {width: 390, height: 844}})
  themed(editorTests)
})
