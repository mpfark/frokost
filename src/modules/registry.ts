import { LucideIcon, UtensilsCrossed, Coffee, ChefHat, Globe, Calendar } from "lucide-react";

export type ModuleKey = "lunch" | "catering" | "kitchen" | "webflow" | "microsoft";
export type ModuleRole = "user" | "admin" | "kitchen" | "platform_admin";

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Roles required to see this module in navigation. Empty = all authenticated users. */
  requires: ModuleRole[];
  /** Whether this module shows up as a tab in the main user navigation. */
  inUserNav: boolean;
  /** Whether this module shows up as a tab in the admin panel. */
  inAdminPanel: boolean;
}

/**
 * Single source of truth for app modules.
 * UI tabs are built by filtering this list against `useEnabledModules()` + the user's roles.
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: "lunch",
    label: "Frokost",
    description: "Daglig frokost-tilmelding",
    icon: UtensilsCrossed,
    requires: [],
    inUserNav: true,
    inAdminPanel: false,
  },
  {
    key: "catering",
    label: "Forplejning",
    description: "Bestilling af forplejning til møder",
    icon: Coffee,
    requires: [],
    inUserNav: true,
    inAdminPanel: false,
  },
  {
    key: "kitchen",
    label: "Køkken",
    description: "Køkkenets overblik over signups og bestillinger",
    icon: ChefHat,
    requires: ["kitchen"],
    inUserNav: true,
    inAdminPanel: false,
  },
  {
    key: "webflow",
    label: "Webflow-sync",
    description: "Synkronisering af brugere med Webflow",
    icon: Globe,
    requires: ["admin"],
    inUserNav: false,
    inAdminPanel: true,
  },
  {
    key: "microsoft",
    label: "Microsoft Kalender",
    description: "Integration med Outlook-kalender og mødelokaler",
    icon: Calendar,
    requires: ["admin"],
    inUserNav: false,
    inAdminPanel: true,
  },
];

export const getModule = (key: ModuleKey) =>
  MODULE_REGISTRY.find((m) => m.key === key);
