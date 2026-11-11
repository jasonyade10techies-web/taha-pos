import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export function Dropdown({
  trigger,
  children,
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="dropdown-content"
          sideOffset={8}
          align="end"
          aria-label={label}
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
export function DropdownItem({
  children,
  onSelect,
  disabled = false,
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu.Item className="dropdown-item" onSelect={onSelect} disabled={disabled}>
      {children}
    </Menu.Item>
  );
}
export const DropdownSeparator = () => (
  <Menu.Separator className="dropdown-separator" />
);
