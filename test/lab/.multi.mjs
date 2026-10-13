import {chromium} from 'playwright'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium'
})
const page = await browser.newPage({
  viewport: {width: 1720, height: 1250},
  colorScheme: 'dark'
})
const logs = []
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
page.on('console', m => {
  if (m.type() === 'error') logs.push(m.text())
})
await page.goto('http://127.0.0.1:4700/lab/')
await page.waitForFunction(
  () => window.lab?.deployments?.active && !window.lab.lab.busy,
  null,
  {timeout: 60000}
)
await page.getByRole('button', {name: 'Add user'}).click()
for (const user of ['a', 'a', 'b', 'c', 'c']) {
  await page
    .locator(`[data-user="${user}"]`)
    .getByRole('button', {name: '+ Tab'})
    .click()
  await page.waitForTimeout(300)
}
await page.waitForFunction(
  () => window.lab.browsers.every(b => b.tabs.every(t => t.ready)),
  null,
  {timeout: 30000}
)
await page.evaluate(() => window.lab.engine.actions.setLatency(1000))
await page.locator('[data-node="user-c/tab-4"]').click()
await page.locator('aside button', {hasText: 'Home'}).first().click()
await page.getByLabel('Title of home').fill('Home by Linus')
await page.getByRole('button', {name: 'Save', exact: true}).click()
await page.waitForTimeout(2600)
await page.screenshot({path: process.argv[2]})
console.log(logs.join('\n'))
await browser.close()
