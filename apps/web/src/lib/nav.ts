/** The primary navigation, in one place so the desktop bar, the mobile panel
 *  and the footer cannot drift apart. */
export interface NavItem {
  href: string;
  label: string;
  /** Matches child routes too — /docs/security should light up "Docs". */
  prefix?: boolean;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs", prefix: true },
  // { href: "/scan", label: "Scan", prefix: true },
] as const;

/** Whether a nav item is the one the given pathname is currently under. */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return item.prefix ? pathname.startsWith(item.href) : pathname === item.href;
}
