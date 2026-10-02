import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
export const AppSession = createContext<{ user: User | null; isLoading: boolean; isAdmin: boolean; canAccessKitchen: boolean; activeTab: string }>({user:null,isLoading:true,isAdmin:false,canAccessKitchen:false,activeTab:"calendar"});
export const useAppSession = () => useContext(AppSession);
