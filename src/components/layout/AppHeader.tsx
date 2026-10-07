import {
  Calendar,
  CalendarDays,
  ChefHat,
  Settings,
  UtensilsCrossed,
  UserRound,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export interface AppHeaderProps {
  activeTab: string | null;
  fullName: string;
  role: string;
  signedIn: boolean;
  loading: boolean;
  isAdmin: boolean;
  canAccessKitchen: boolean;
  notifications?: ReactNode;
  onLogout: () => void;
  loggingOut: boolean;
}

export function AppHeader({
  activeTab,
  fullName,
  role,
  signedIn,
  loading,
  isAdmin,
  canAccessKitchen,
  notifications,
  onLogout,
  loggingOut,
}: AppHeaderProps) {
  const items = [
    { id: "calendar", label: "Min plan", icon: Calendar },
    { id: "outlook", label: "Forplejning", icon: CalendarDays },
    ...(canAccessKitchen
      ? [{ id: "kitchen", label: "Køkken", icon: ChefHat }]
      : []),
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: Settings }] : []),
  ];
  return (
    <div className="app-top">
      <header
        data-app-header
        className="border-b border-border bg-card/95 backdrop-blur"
      >
        <div className="app-container app-header-row">
          <Link
            to="/"
            aria-label="Frokost – forsiden"
            title="Frokost"
            className="app-brand"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <UtensilsCrossed className="size-5" aria-hidden="true" />
            </span>
            <span className="app-brand-copy min-w-0">
              <span className="hidden text-base font-bold sm:block sm:text-xl">
                Pluskontoret Arkitekter
              </span>
              <span className="block text-xs text-muted-foreground">
                Frokost og forplejning
              </span>
            </span>
          </Link>
          <div className="app-header-actions">
            <span className="app-user-copy" aria-busy={loading}>
              <span
                className="block truncate text-sm font-medium"
                title={fullName}
              >
                {loading
                  ? "Indlæser bruger…"
                  : signedIn
                    ? fullName
                    : "Ikke logget ind"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {loading
                  ? "Indlæser rolle…"
                  : signedIn
                    ? role
                    : "Log ind på forsiden"}
              </span>
            </span>
            <div className="app-notification-slot">
              {signedIn && !loading ? notifications : null}
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="app-action app-profile bg-muted"
              disabled={loading}
            >
              <Link
                to={signedIn ? "/?tab=profile" : "/"}
                aria-label={signedIn ? "Åbn profil" : "Gå til login"}
                aria-current={activeTab === "profile" ? "page" : undefined}
              >
                <UserRound className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="app-action"
              aria-label="Log ud"
              onClick={onLogout}
              disabled={!signedIn || loading || loggingOut}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <div data-app-navigation className="app-container app-nav-frame">
        <nav aria-label="Hovednavigation" className="app-nav">
          {items.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={"/?tab=" + id}
              aria-label={label}
              title={label}
              aria-current={activeTab === id ? "page" : undefined}
              className="app-nav-item"
            >
              <Icon aria-hidden="true" />
              <span className="app-nav-label">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
