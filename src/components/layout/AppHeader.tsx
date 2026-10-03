import { Calendar, CalendarDays, ChefHat, Settings, UtensilsCrossed, UserRound, LogOut } from "lucide-react";
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

export function AppHeader({ activeTab, fullName, role, signedIn, loading, isAdmin, canAccessKitchen, notifications, onLogout, loggingOut }: AppHeaderProps) {
  const items = [
    { id: "calendar", label: "Min plan", icon: Calendar },
    { id: "outlook", label: "Forplejning", icon: CalendarDays },
    ...(canAccessKitchen ? [{ id: "kitchen", label: "Køkken", icon: ChefHat }] : []),
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: Settings }] : []),
  ];
  const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  return <div className="sticky top-0 z-30 bg-background">
    <header data-app-header className="border-b border-border bg-card/95 backdrop-blur">
      <div className="app-container flex flex-wrap items-center justify-between sm:flex-nowrap">
        <Link to="/" className={"flex h-16 w-full min-w-0 items-center gap-3 rounded-lg text-left sm:w-auto " + focus}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><UtensilsCrossed className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0"><span className="hidden text-base font-bold sm:block sm:text-xl">Pluskontoret Arkitekter</span><span className="block text-xs text-muted-foreground">Frokost og forplejning</span></span>
        </Link>
        <div className="flex h-12 w-full min-w-0 items-center justify-end gap-2 pb-2 sm:h-16 sm:w-auto sm:gap-3 sm:pb-0">
          <span className="mr-auto min-w-0 flex-1 text-left sm:mr-0 sm:w-48 sm:flex-none sm:text-right" aria-busy={loading}>
            <span className="block truncate text-sm font-medium" title={fullName}>{loading ? "Indlæser bruger…" : signedIn ? fullName : "Ikke logget ind"}</span>
            <span className="block truncate text-xs text-muted-foreground">{loading ? "Indlæser rolle…" : signedIn ? role : "Log ind på forsiden"}</span>
          </span>
          <div className="size-9 shrink-0 [&>button]:size-9">{signedIn && !loading ? notifications : null}</div>
          <Button asChild variant="ghost" size="icon" className="size-9 shrink-0 rounded-full bg-muted" disabled={loading}>
            <Link to={signedIn ? "/?tab=profile" : "/"} aria-label={signedIn ? "Åbn profil" : "Gå til login"} aria-current={activeTab === "profile" ? "page" : undefined}><UserRound className="size-4" aria-hidden="true" /></Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Log ud" onClick={onLogout} disabled={!signedIn || loading || loggingOut}><LogOut className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>
    </header>
    <div data-app-navigation className="app-container border-b border-border py-3">
      <nav aria-label="Hovednavigation" className="flex gap-2 overflow-x-auto py-1 -my-1">
        {items.map(({id,label,icon:Icon}) => <Link key={id} to={"/?tab=" + id} aria-current={activeTab === id ? "page" : undefined} className={"flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " + focus + " " + (activeTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" aria-hidden="true" />{label}</Link>)}
      </nav>
    </div>
  </div>;
}
