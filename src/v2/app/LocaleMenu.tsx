import { Button, Menu, MenuItem } from "@alinea/components";
import { IcRoundUnfoldMore } from "alinea/ui/icons/IcRoundUnfoldMore.js";
import { useAtom, useAtomValue } from "jotai";
import { DashboardRoot } from "../store/Dashboard.js";

interface LocaleMenuProps {
  root: DashboardRoot;
}

export function LocaleMenu({ root }: LocaleMenuProps) {
  const i18n = useAtomValue(root.i18n);
  const [selectedLocale, setSelectedLocale] = useAtom(root.selectedLocale);
  if (!i18n || !selectedLocale) return null;
  return (
    <Menu
      label={
        <Button appearance="outline" intent="secondary">
          {selectedLocale.toUpperCase()} <IcRoundUnfoldMore />
        </Button>
      }
      aria-label="Language"
      selectionMode="single"
      selectedKeys={new Set([selectedLocale])}
      onAction={(key) => {
        setSelectedLocale(String(key));
      }}
    >
      {i18n.locales.map((locale) => (
        <MenuItem key={locale} id={locale}>
          {locale.toUpperCase()}
        </MenuItem>
      ))}
    </Menu>
  );
}
