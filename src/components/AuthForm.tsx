import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";
import { detectTeamsContext, getTeamsAuthToken, validateTeamsToken } from "@/lib/teams-context";

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInTeams, setIsInTeams] = useState(false);
  const [teamsAuthAttempted, setTeamsAuthAttempted] = useState(false);

  useEffect(() => {
    const checkTeamsContext = async () => {
      const inTeams = detectTeamsContext();
      setIsInTeams(inTeams);
      
      if (inTeams && !teamsAuthAttempted) {
        setTeamsAuthAttempted(true);
        await handleTeamsAuth();
      }
    };
    
    checkTeamsContext();
  }, [teamsAuthAttempted]);

  const handleTeamsAuth = async () => {
    setIsLoading(true);
    try {
      const token = await getTeamsAuthToken();
      
      if (!token) {
        console.log('No Teams token available, falling back to email/password');
        setIsLoading(false);
        return;
      }

      const result = await validateTeamsToken(token);
      
      if (result.session_url) {
        // Navigate to the magic link to establish session
        window.location.href = result.session_url;
      } else {
        toast.success(`Welcome ${result.user.full_name}!`);
      }
    } catch (error: any) {
      console.error('Teams auth error:', error);
      toast.error('Teams authentication failed. Please use email/password.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("Account created! You can now log in.");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <UtensilsCrossed className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Office Lunch</CardTitle>
          <CardDescription>
            {isInTeams 
              ? "Signing in with Microsoft Teams..." 
              : isLogin ? "Sign in to your account" : "Create a new account"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && isInTeams ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Authenticating with Teams...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="John Doe"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>
          )}
          {!isInTeams && (
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
