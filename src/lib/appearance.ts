export type Appearance = { font: "Manrope" | "Inter" | "System"; primary: string; accent: string; success: string; warning: string; danger: string };
export const defaultAppearance: Appearance = { font: "Manrope", primary: "#F2BC2D", accent: "#E53935", success: "#168344", warning: "#965707", danger: "#DC2626" };
/** Upgrade the former shipped palette only; preserve deliberately saved branding. */
export function migrateAppearance(value: Appearance): Appearance {
  const previous = {...defaultAppearance,primary:'#FFC107'};
  return Object.keys(previous).every(key => value[key as keyof Appearance] === previous[key as keyof Appearance]) ? {...defaultAppearance} : value;
}
export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const parts = [n >> 16, n >> 8 & 255, n & 255].map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
    return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722;
  };
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export const colorText = (color: string) => contrast(color, "#202020")>=4.5?"#202020":contrast(color,"#FFFFFF")>=4.5?"#FFFFFF":"#000000";
function readableInDark(hex: string) {
  let value = hex;
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let amount = 0; amount <= 1; amount += .05) {
    value = '#' + rgb.map(channel => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')).join('');
    if (contrast(value, '#303030') >= 4.5) break;
  }
  return value;
}
function readableInLight(hex:string,background:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));for(let amount=0;amount<=1;amount+=.02){const value='#'+rgb.map(channel=>Math.round(channel*(1-amount)).toString(16).padStart(2,'0')).join('');if(contrast(value,background)>=4.5)return value;}return '#17181A';}
export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  root.style.setProperty("--app-font", a.font === "System" ? "system-ui, sans-serif" : `"${a.font}", "Inter", sans-serif`);
  const defaults = JSON.stringify(a) === JSON.stringify(defaultAppearance);
  const dark = root.classList.contains("dark");
  const tokens = { gold: a.primary, "gold-hover": a.primary, "on-primary": colorText(a.primary), red: a.accent, green: dark ? readableInDark(a.success) : readableInLight(a.success,'#ECFDF3'), amber: dark ? readableInDark(a.warning) : readableInLight(a.warning,'#FFFAEB'), danger: dark ? readableInDark(a.danger) : readableInLight(a.danger,'#FEF2F2') };
  for (const [key, value] of Object.entries(tokens)) {
    if (defaults && key !== "on-primary") root.style.removeProperty(`--${key}`);
    else root.style.setProperty(`--${key}`, value);
  }
}
export function appearanceErrors(a: Appearance) {
  const errors: string[] = [];
  for (const key of ["primary", "accent", "success", "warning", "danger"] as const) if (!/^#[0-9a-f]{6}$/i.test(a[key])) errors.push(`${key}: enter a six-digit hex color.`);
  if (!errors.length) for (const key of ["success", "warning", "danger"] as const) if (contrast(a[key], "#FFFFFF") < 4.5) errors.push(`${key}: choose a darker color for readable status text in light mode (4.5:1).`);
  return errors;
}
