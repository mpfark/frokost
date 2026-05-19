import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { resolveTenant, TenantResolution } from "@/lib/tenant-resolver";

const TenantContext = createContext<TenantResolution | null>(null);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [resolution, setResolution] = useState<TenantResolution | null>(null);

  useEffect(() => {
    resolveTenant().then(setResolution).catch((err) => {
      console.error("Tenant resolution failed:", err);
      setResolution({ mode: "platform", company: null, hostname: window.location.hostname });
    });
  }, []);

  if (!resolution) return null;

  return <TenantContext.Provider value={resolution}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside TenantProvider");
  return ctx;
};

export const useCurrentCompany = () => useTenant().company;
