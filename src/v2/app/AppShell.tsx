import { ProgressCircle } from "@alinea/components";
import styler from "@alinea/styler";
import { Allotment } from "allotment";
import { useAtomValue } from "jotai";
import { Suspense } from "react";
import { DashboardScopeInternal } from "../store.js";
import type { Dashboard } from "../store/Dashboard.js";
import css from "./AppShell.module.css";
import { Editor } from "./Editor.js";
import { SidebarTree } from "./SidebarTree.js";
import { Rail } from "./ui/Rail.js";
import { Sidebar, SidebarFooter, SidebarHeader } from "./ui/Sidebar.js";
import { WorkspaceMenu } from "./WorkspaceMenu.js";

const styles = styler(css);

interface AppShellProps {
  dashboard: Dashboard;
}

export function AppShell({ dashboard }: AppShellProps) {
  const sha = useAtomValue(dashboard.sha);
  return (
    <main className={styles.root()}>
      <DashboardScopeInternal dashboard={dashboard}>
        <Allotment className={styles.allotment()} snap>
          <Allotment.Pane minSize={196} maxSize={432} preferredSize={272}>
            <Sidebar>
              <SidebarHeader>
                <WorkspaceMenu dashboard={dashboard} />
              </SidebarHeader>

              <SidebarTree dashboard={dashboard} />

              <SidebarFooter>
                <div>db.sha: {sha}</div>
              </SidebarFooter>
            </Sidebar>
          </Allotment.Pane>
          <Allotment.Pane snap={false}>
            <Suspense
              fallback={
                <Rail
                  main
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  <ProgressCircle isIndeterminate aria-label="loading" />
                </Rail>
              }
            >
              <Editor dashboard={dashboard} />
            </Suspense>
          </Allotment.Pane>
        </Allotment>
      </DashboardScopeInternal>
    </main>
  );
}
