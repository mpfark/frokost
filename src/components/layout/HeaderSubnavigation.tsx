import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HeaderNavigationContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

export function HeaderNavigationProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <HeaderNavigationContext.Provider value={{ target, setTarget }}>
      {children}
    </HeaderNavigationContext.Provider>
  );
}

export function HeaderNavigationSlot() {
  const navigation = useContext(HeaderNavigationContext);
  return <div ref={navigation?.setTarget} className="app-subnav-slot" />;
}

// A portal keeps the Radix tab context and keyboard controls intact while
// placing the page's navigation inside the shared sticky header.
export function HeaderSubnavigation({ children }: { children: ReactNode }) {
  const navigation = useContext(HeaderNavigationContext);
  if (!navigation?.target) return null;
  return createPortal(
    <div className="app-container app-subnav-frame">{children}</div>,
    navigation.target,
  );
}
