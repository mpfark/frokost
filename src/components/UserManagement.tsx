import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Pencil, Save, X, KeyRound, UtensilsCrossed, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { profileSchema } from "@/lib/validations";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  is_vegetarian: boolean;
}

interface UserWithRoles extends UserProfile {
  roles: string[];
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);

  const fetchUsers = async () => {
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("email");

    if (profilesError) {
      toast.error("Kunne ikke indlæse brugere");
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      toast.error("Kunne ikke indlæse brugerroller");
      return;
    }

    // Combine profiles with their roles
    const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
      ...profile,
      roles: roles?.filter((r) => r.user_id === profile.id).map((r) => r.role) || [],
    }));

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isUserAdmin = (user: UserWithRoles) => {
    return user.roles?.includes("admin");
  };

  const isUserKitchen = (user: UserWithRoles) => {
    return user.roles?.includes("kitchen");
  };

  const toggleKitchenRole = async (userId: string, currentlyKitchen: boolean) => {
    setIsLoading(true);
    try {
      if (currentlyKitchen) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "kitchen");

        if (error) throw error;
        toast.success("Køkkenrolle fjernet");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "kitchen" });

        if (error) throw error;
        toast.success("Køkkenrolle tildelt");
      }
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentlyAdmin: boolean) => {
    setIsLoading(true);
    try {
      if (currentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Adminrolle fjernet");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Adminrolle tildelt");
      }
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (user: UserProfile) => {
    setEditingUser(user.id);
    setEditForm({
      full_name: user.full_name,
      is_gluten_free: user.is_gluten_free,
      is_lactose_free: user.is_lactose_free,
      is_vegetarian: user.is_vegetarian,
    });
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const saveUser = async (userId: string) => {
    setIsLoading(true);
    try {
      // Validate profile data
      const validationResult = profileSchema.safeParse({
        fullName: editForm.full_name || "",
        isGlutenFree: editForm.is_gluten_free || false,
        isLactoseFree: editForm.is_lactose_free || false,
        isVegetarian: editForm.is_vegetarian || false,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: validationResult.data.fullName,
          is_gluten_free: validationResult.data.isGlutenFree,
          is_lactose_free: validationResult.data.isLactoseFree,
          is_vegetarian: validationResult.data.isVegetarian,
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Bruger opdateret");
      setEditingUser(null);
      setEditForm({});
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email },
      });

      if (error) throw error;
      toast.success(`Adgangskode nulstillings-email sendt til ${email}`);
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke sende adgangskode nulstillings-email");
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteDialog = (user: UserWithRoles) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const deleteUser = async () => {
    if (!userToDelete) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: userToDelete.id },
      });

      if (error) throw error;
      
      // Optimistically update the UI by removing the deleted user from state
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));
      
      toast.success(`Bruger ${userToDelete.email} slettet`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      
      // Refetch to ensure data consistency
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke slette bruger");
      // On error, refetch to restore correct state
      await fetchUsers();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Indlæser brugere...</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Brugerstyring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((user) => {
                const isAdmin = isUserAdmin(user);
                const isEditing = editingUser === user.id;
                const isKitchen = isUserKitchen(user);
                
                return (
                  <Card key={user.id} className="p-3">
                    <div className="space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0 order-1 md:order-2">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div>
                                <Label htmlFor="full_name">Fulde navn</Label>
                                <Input
                                  id="full_name"
                                  value={editForm.full_name || ""}
                                  onChange={(e) =>
                                    setEditForm({ ...editForm, full_name: e.target.value })
                                  }
                                />
                              </div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{user.full_name || "Intet navn"}</span>
                                {user.is_gluten_free && <Badge variant="secondary" className="text-xs">Glutenfri</Badge>}
                                {user.is_lactose_free && <Badge variant="secondary" className="text-xs">Laktosefri</Badge>}
                                {user.is_vegetarian && <Badge variant="secondary" className="text-xs">Vegetar</Badge>}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                            </>
                          )}
                        </div>
                        
                        {!isEditing && (
                          <div className="flex gap-1 order-2 md:order-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => startEditing(user)}
                                  disabled={isLoading}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Rediger</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => toggleAdminRole(user.id, isAdmin)}
                                  disabled={isLoading}
                                  variant={isAdmin ? "default" : "ghost"}
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  {isAdmin ? <Shield className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{isAdmin ? "Fjern admin" : "Gør til admin"}</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => toggleKitchenRole(user.id, isKitchen)}
                                  disabled={isLoading}
                                  variant={isKitchen ? "secondary" : "ghost"}
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <UtensilsCrossed className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{isKitchen ? "Fjern køkken" : "Gør til køkken"}</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => sendPasswordReset(user.email)}
                                  disabled={isLoading}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Nulstil adgangskode</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => openDeleteDialog(user)}
                                  disabled={isLoading}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Slet bruger</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 ml-11">
                          <Label>Kostbegrænsninger</Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`gluten-${user.id}`}
                                checked={editForm.is_gluten_free || false}
                                onCheckedChange={(checked) =>
                                  setEditForm({ ...editForm, is_gluten_free: checked as boolean })
                                }
                              />
                              <Label htmlFor={`gluten-${user.id}`}>Glutenfri</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`lactose-${user.id}`}
                                checked={editForm.is_lactose_free || false}
                                onCheckedChange={(checked) =>
                                  setEditForm({ ...editForm, is_lactose_free: checked as boolean })
                                }
                              />
                              <Label htmlFor={`lactose-${user.id}`}>Laktosefri</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`vegetarian-${user.id}`}
                                checked={editForm.is_vegetarian || false}
                                onCheckedChange={(checked) =>
                                  setEditForm({ ...editForm, is_vegetarian: checked as boolean })
                                }
                              />
                              <Label htmlFor={`vegetarian-${user.id}`}>Vegetar</Label>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => saveUser(user.id)}
                              disabled={isLoading}
                              size="sm"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Gem
                            </Button>
                            <Button
                              onClick={cancelEditing}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Annuller
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Slet bruger</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på, at du vil slette <strong>{userToDelete?.email}</strong>? 
                Denne handling kan ikke fortrydes. Alle brugerdata, tilmeldinger og tilknyttede poster vil blive permanent slettet.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Annuller</AlertDialogCancel>
              <AlertDialogAction 
                onClick={deleteUser} 
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? "Sletter..." : "Slet bruger"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};
