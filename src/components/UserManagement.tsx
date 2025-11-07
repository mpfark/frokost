import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, ShieldOff, Pencil, Save, X, KeyRound } from "lucide-react";
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

  const fetchUsers = async () => {
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("email");

    if (profilesError) {
      toast.error("Failed to load users");
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      toast.error("Failed to load user roles");
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
        toast.success("Admin role removed");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Admin role granted");
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
      toast.success("User updated successfully");
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
      toast.success(`Password reset email sent to ${email}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to send password reset email");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => {
              const isAdmin = isUserAdmin(user);
              const isEditing = editingUser === user.id;

              return (
                <Card key={user.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div>
                              <Label htmlFor="full_name">Full Name</Label>
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
                            <div className="font-medium">{user.full_name || "No name"}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isAdmin && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <Label>Dietary Restrictions</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`gluten-${user.id}`}
                              checked={editForm.is_gluten_free || false}
                              onCheckedChange={(checked) =>
                                setEditForm({ ...editForm, is_gluten_free: checked as boolean })
                              }
                            />
                            <Label htmlFor={`gluten-${user.id}`}>Gluten Free</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`lactose-${user.id}`}
                              checked={editForm.is_lactose_free || false}
                              onCheckedChange={(checked) =>
                                setEditForm({ ...editForm, is_lactose_free: checked as boolean })
                              }
                            />
                            <Label htmlFor={`lactose-${user.id}`}>Lactose Free</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`vegetarian-${user.id}`}
                              checked={editForm.is_vegetarian || false}
                              onCheckedChange={(checked) =>
                                setEditForm({ ...editForm, is_vegetarian: checked as boolean })
                              }
                            />
                            <Label htmlFor={`vegetarian-${user.id}`}>Vegetarian</Label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      user.is_gluten_free || user.is_lactose_free || user.is_vegetarian ? (
                        <div className="flex gap-2 flex-wrap">
                          {user.is_gluten_free && <Badge variant="secondary">Gluten Free</Badge>}
                          {user.is_lactose_free && <Badge variant="secondary">Lactose Free</Badge>}
                          {user.is_vegetarian && <Badge variant="secondary">Vegetarian</Badge>}
                        </div>
                      ) : null
                    )}

                    <div className="flex gap-2 pt-2 flex-wrap">
                      {isEditing ? (
                        <>
                          <Button
                            onClick={() => saveUser(user.id)}
                            disabled={isLoading}
                            size="sm"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            onClick={cancelEditing}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => startEditing(user)}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => toggleAdminRole(user.id, isAdmin)}
                            disabled={isLoading}
                            variant={isAdmin ? "destructive" : "default"}
                            size="sm"
                          >
                            {isAdmin ? (
                              <>
                                <ShieldOff className="w-4 h-4 mr-2" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4 mr-2" />
                                Make Admin
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => sendPasswordReset(user.email)}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            <KeyRound className="w-4 h-4 mr-2" />
                            Reset Password
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
