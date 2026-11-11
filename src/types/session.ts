export type ThemePreference = "light" | "dark" | "system";
export interface Employee {
  id: string;
  name: string;
  role: "Owner / Admin" | "Manager" | "Employee" | "Signed out";
  initials: string;
}
export interface Branch {
  id: string;
  name: string;
}
