import {expect, test} from '@playwright/experimental-ct-react'
import {SidebarTreeStory} from './SidebarTree.story.js'

test('mounts the sidebar tree', async ({mount}) => {
  const component = await mount(<SidebarTreeStory />)
  await expect(
    component.getByRole('treegrid', {name: 'Content tree'})
  ).toBeVisible()
  await expect(component.getByText('Pages')).toBeVisible()
  await expect(component.getByText('Media')).toBeVisible()
})
