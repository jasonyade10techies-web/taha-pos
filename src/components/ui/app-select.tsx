import {
  Children,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
type Option = { value: string; label: ReactNode; disabled?: boolean };
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>(child)
    )
      return [];
    return child.type === "option"
      ? [
          {
            value: String(child.props.value ?? child.props.children ?? ""),
            label: child.props.children,
            disabled: child.props.disabled,
          },
        ]
      : optionsOf(child.props.children);
  });
}
export function AppSelect({
  children,
  value,
  defaultValue,
  onChange,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const native = useRef<HTMLSelectElement>(null),
    [internal, setInternal] = useState(String(defaultValue ?? ""));
  const options = optionsOf(children),
    selected = String(value ?? internal);
  const choose = (next: string) => {
    setInternal(next);
    if (native.current) native.current.value = next;
    onChange?.({
      target: native.current,
      currentTarget: native.current,
    } as ChangeEvent<HTMLSelectElement>);
  };
  return (
    <span className="app-select">
      <select
        {...props}
        value={selected}
        onChange={onChange}
        ref={native}
        tabIndex={-1}
        aria-hidden="true"
        className="app-select-native"
        onInvalid={(event) => {
          event.preventDefault();
          native.current?.parentElement?.querySelector("button")?.focus();
        }}
      >
        {children}
      </select>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button
            type="button"
            className={`input app-select-trigger ${className}`}
            disabled={props.disabled}
            aria-label={props["aria-label"]}
            id={props.id ? `${props.id}-trigger` : undefined}
          >
            <span>
              {options.find((o) => o.value === selected)?.label ?? "Select…"}
            </span>
            <ChevronDown size={16} />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            className="app-select-menu"
            sideOffset={5}
            collisionPadding={12}
          >
            {options.map((option, index) => (
              <Dropdown.Item
                key={`${option.value}-${index}`}
                disabled={option.disabled}
                className="app-select-option"
                onSelect={() => choose(option.value)}
              >
                {option.label}
                {selected === option.value && <Check size={16} />}
              </Dropdown.Item>
            ))}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </span>
  );
}
