import {
  Button,
  DialogTrigger,
  Icon as IconComp,
  Menu,
  MenuItem,
} from "@alinea/components";
import styler from "@alinea/styler";
import { IcRoundUnfoldMore } from "alinea/ui/icons/IcRoundUnfoldMore.js";
import { useAtom, useAtomValue } from "jotai";
import { IcAlineaLogo, IcRoundSearch } from "../icons.js";
import type { Dashboard, DashboardWorkspace } from "../store/Dashboard.js";
import css from "./WorkspaceMenu.module.css";
import { Sheet } from "./ui/Sheet.js";

const styles = styler(css);

interface WorkspaceMenuProps {
  dashboard: Dashboard;
}

export function WorkspaceMenu({ dashboard }: WorkspaceMenuProps) {
  const [selected, setSelected] = useAtom(dashboard.selectedWorkspace);
  const workspaces = useAtomValue(dashboard.workspaces);
  const workspace = dashboard.workspace(selected);
  const color = useAtomValue(workspace.color);
  const Icon = useAtomValue(workspace.icon) ?? IcAlineaLogo;
  const label = useAtomValue(workspace.label);
  return (
    <div className={styles.parent()}>
      <span
        className={styles.triggerAvatar()}
        style={{ backgroundColor: color }}
      >
        <Icon />
      </span>

      <Menu
        label={
          <Button
            appearance="outline"
            intent="secondary"
            className={styles.trigger()}
          >
            <span className={styles.triggerText()}>{label}</span>
            <IcRoundUnfoldMore />
          </Button>
        }
        aria-label="Workspace"
        selectionMode="single"
        selectedKeys={[selected]}
        onAction={(key) => setSelected(String(key))}
      >
        {workspaces.map((workspace) => (
          <WorkspaceItem
            key={workspace}
            workspace={dashboard.workspace(workspace)}
          />
        ))}
      </Menu>
      <DialogTrigger>
        <Button size="icon" appearance="outline">
          <IconComp icon={IcRoundSearch} data-slot="icon" />
        </Button>
        <Sheet></Sheet>
      </DialogTrigger>
    </div>
  );
}

interface WorkspaceItemProps {
  workspace: DashboardWorkspace;
}

function WorkspaceItem({ workspace }: WorkspaceItemProps) {
  const id = workspace.key;
  const label = useAtomValue(workspace.label);
  return (
    <MenuItem key={id} id={id} textValue={label}>
      {label}
    </MenuItem>
  );
}
