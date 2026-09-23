import type {Locator, Page} from 'playwright'
import {routes} from './support/VisualRoutes.js'
import {
  FieldsScenarioMount,
  FixtureScenarioMount
} from './support/VisualScenarioMount.js'
import {expect, test, themed, type VisualDriver} from './support/VisualTest.js'

async function reveal(locator: Locator) {
  await locator.evaluate(element =>
    element.scrollIntoView({block: 'center', inline: 'nearest'})
  )
}

/** Screenshot the whole document tab in a viewport tall enough to fit it */
async function documentShot(app: VisualDriver, name: string, height = 2400) {
  await app.page.setViewportSize({width: 1280, height})
  const panel = app.page.getByRole('tabpanel').first()
  await app.shot(name, panel)
}

function field(page: Page, label: string) {
  return page.getByText(label, {exact: true}).first()
}

themed(() => {
  test('all fields', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await documentShot(app, 'fields-home', 3000)
  })

  test('rich text blocks and lists', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.blocks,
      title: 'Rich Text Blocks Demo'
    })
    await documentShot(app, 'fields-blocks', 3000)
  })

  test('metadata tab', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('tab', {name: 'Metadata'}).click()
    await expect(app.page.getByRole('tab', {name: 'Metadata'})).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await app.shot('fields-metadata')
  })

  test('tabs field', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FieldsScenarioMount />), {
      hash: '#/entry/main/pages/visual-tabbed',
      title: 'Tabbed page'
    })
    await app.shot('fields-tabs')
  })

  test('select field popover', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const trigger = app.page.getByRole('button', {name: 'Docs Category'})
    await reveal(trigger)
    await trigger.click()
    await expect(app.page.getByRole('listbox')).toBeVisible()
    await app.shot('field-select-open')
  })

  test('multi select field popover', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const group = app.page.getByRole('group', {name: 'Audiences'})
    await reveal(group)
    await group.getByRole('button').last().click()
    await expect(app.page.getByRole('listbox')).toBeVisible()
    await app.shot('field-multiselect-open')
  })

  test('date field calendar', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const trigger = app.page.getByRole('button', {
      name: 'Calendar Publish date'
    })
    await reveal(trigger)
    await trigger.click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('field-date-open')
  })

  test('focused inputs', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const input = app.page.getByRole('textbox', {name: 'Word count'})
    await reveal(input)
    await input.focus()
    await app.shot('field-number-focus')
    const time = app.page.getByRole('spinbutton', {name: /hour, Publish time/})
    await time.focus()
    await app.shot('field-time-focus')
  })

  test('list field rows', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const list = app.page.getByRole('list', {name: 'Sections'})
    await reveal(list)
    await app.shot('field-list-expanded')
    await app.page.getByRole('button', {name: 'Collapse all items'}).click()
    await expect(
      list.getByRole('button', {name: 'Expand Callout'}).first()
    ).toBeVisible()
    await reveal(list)
    await app.shot('field-list-collapsed')
  })

  test('list field row settings', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const list = app.page.getByRole('list', {name: 'Sections'})
    await reveal(list)
    await list.getByRole('button', {name: 'Callout actions'}).first().click()
    await expect(
      app.page.getByRole('dialog', {name: 'Callout actions'})
    ).toBeVisible()
    await app.shot('field-list-settings')
  })

  test('list field type picker', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FieldsScenarioMount />), {
      hash: '#/entry/main/pages/visual-tabbed',
      title: 'Tabbed page'
    })
    await app.page.getByRole('button', {name: 'More block types'}).click()
    await expect(
      app.page.getByRole('dialog', {name: 'More block types'})
    ).toBeVisible()
    await app.shot('field-list-type-picker')
  })

  test('list field insert command', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FieldsScenarioMount />), {
      hash: '#/entry/main/pages/visual-tabbed',
      title: 'Tabbed page'
    })
    await app.page.getByRole('button', {name: 'Quote actions'}).click()
    await app.page.getByRole('button', {name: 'Insert before'}).click()
    await expect(
      app.page
        .getByRole('searchbox', {name: 'Search types'})
        .or(app.page.getByRole('combobox', {name: 'Search types'}))
    ).toBeVisible()
    await app.shot('field-list-insert')
  })

  test('rich text toolbar', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const paragraph = app.page.getByText('Try toolbar actions', {exact: true})
    await reveal(paragraph)
    await paragraph.click()
    await expect(
      app.page.getByRole('toolbar', {name: 'Text formatting'})
    ).toBeVisible()
    await app.shot('field-richtext-toolbar')
  })

  test('rich text insert menu', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.blocks,
      title: 'Rich Text Blocks Demo'
    })
    const paragraph = app.page.getByText(
      'The quote below is another rich text block instance',
      {exact: false}
    )
    await reveal(paragraph)
    await paragraph.click()
    await app.page.keyboard.press('End')
    await app.page.keyboard.press('Enter')
    const insert = app.page.getByRole('button', {name: 'Insert block'})
    await expect(insert).toBeVisible()
    // The editor scrolls the caret into view, capture the elements themselves
    // so the shots do not depend on the scroll position
    await app.shot('field-richtext-insert-button', insert)
    await insert.click()
    const menu = app.page.getByRole('menu', {name: 'Insert block'})
    await expect(menu).toBeVisible()
    await app.shot('field-richtext-insert-menu', menu)
  })

  test('code field focus', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const code = app.page.getByRole('textbox', {name: 'Code sample'})
    await reveal(code)
    await code.click()
    await app.shot('field-code-focus')
  })

  test('object field', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const object = field(app.page, 'Testje')
    await reveal(object)
    await app.shot('field-object')
  })
})
