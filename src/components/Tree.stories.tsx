import {IcOutlineDescription} from '../stories/icons/IcOutlineDescription.js'
import {IcRoundDescription} from '../stories/icons/IcRoundDescription.js'
import {IcRoundEdit} from '../stories/icons/IcRoundEdit.js'
import {IcRoundHome} from '../stories/icons/IcRoundHome.js'
import {IcRoundVisibility} from '../stories/icons/IcRoundVisibility.js'
import {IcRoundVisibilityOff} from '../stories/icons/IcRoundVisibilityOff.js'
import {Tree, TreeItem} from './Tree.js'

export const Example = () => (
  <Tree aria-label="Files" defaultExpandedKeys={['docs', 'blog']}>
    <TreeItem title="Documents" id="docs" icon={<IcOutlineDescription />}>
      <TreeItem title="Project" icon={<IcOutlineDescription />}>
        <TreeItem title="Weekly Report" icon={<IcRoundDescription />} />
      </TreeItem>
    </TreeItem>
    <TreeItem title="Photos" icon={<IcOutlineDescription />}>
      <TreeItem title="Image 1" icon={<IcRoundDescription />} />
      <TreeItem title="Image 2" icon={<IcRoundDescription />} />
    </TreeItem>
  </Tree>
)

export function WithStatus() {
  return (
    <Tree
      aria-label="Pages"
      defaultExpandedKeys={['folder', 'status', 'unpublished']}
      selectionMode="single"
      defaultSelectedKeys={['published']}
    >
      <TreeItem title="Examples" id="examples" icon={<IcOutlineDescription />}>
        <TreeItem title="Getting Started" icon={<IcRoundDescription />} />
      </TreeItem>
      <TreeItem title="Folder" id="folder" icon={<IcOutlineDescription />}>
        <TreeItem
          title="Sub folder"
          icon={<IcOutlineDescription />}
          suffix={<IcRoundHome style={{width: 14, height: 14}} />}
        />
      </TreeItem>
      <TreeItem title="Status" id="status" icon={<IcOutlineDescription />}>
        <TreeItem
          id="published"
          title="Published"
          icon={<IcRoundDescription />}
          suffix={
            <IcRoundVisibility
              style={{width: 14, height: 14, color: '#16a34a'}}
            />
          }
        />
        <TreeItem
          title="Sub folder"
          icon={<IcOutlineDescription />}
          suffix={<IcRoundHome style={{width: 14, height: 14}} />}
        />
        <TreeItem
          title="Unpublished"
          id="unpublished"
          icon={<IcOutlineDescription />}
          suffix={
            <IcRoundVisibilityOff
              style={{width: 14, height: 14, color: '#d97706'}}
            />
          }
        >
          <TreeItem
            title="Inner"
            icon={<IcRoundDescription />}
            suffix={
              <IcRoundVisibilityOff
                style={{width: 14, height: 14, color: '#d97706'}}
              />
            }
          />
        </TreeItem>
        <TreeItem
          title="Draft"
          icon={<IcRoundDescription />}
          suffix={
            <IcRoundEdit style={{width: 14, height: 14, color: '#2563eb'}} />
          }
        />
      </TreeItem>
    </Tree>
  )
}

export default {
  title: 'Components / Tree'
}
