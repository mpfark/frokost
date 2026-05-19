import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { UtensilsCrossed, AlertCircle, ArrowLeft } from "lucide-react";
import { z } from "zod";

type AuthMode = "otp-email" | "otp-code";

const emailSchema = z.string().trim().email({ message: "Indtast en gyldig e-mail" }).max(255);

export const AuthForm = () => {
  const [mode, setMode] = useState<AuthMode>("otp-email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const sendOtp = async (isResend = false) => {
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      toast.success(isResend ? "Ny kode sendt til din e-mail" : "Vi har sendt en kode til din e-mail");
      setMode("otp-code");
      setOtpCode("");
      setResendCountdown(60);
    } catch (error: any) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("not found") || msg.includes("signups not allowed") || msg.includes("user not found")) {
        toast.error("Ingen konto fundet med denne e-mail. Kontakt en administrator for at få en invitation.");
      } else if (msg.includes("rate") || msg.includes("too many")) {
        toast.error("For mange forsøg. Vent et øjeblik og prøv igen.");
      } else {
        toast.error(error.message || "Kunne ikke sende kode");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Indtast den 6-cifrede kode");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode,
        type: "email",
      });

      if (error) throw error;
    } catch (error: any) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("expired") || msg.includes("invalid")) {
        toast.error("Koden er ugyldig eller udløbet. Prøv at sende en ny kode.");
      } else {
        toast.error(error.message || "Kunne ikke verificere kode");
      }
      setOtpCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "otp-email") sendOtp(false);
    else if (mode === "otp-code") verifyOtp();
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
          <CardTitle className="text-2xl">Plusfrokost</CardTitle>
          <CardDescription>
            {mode === "otp-email" && "Indtast din e-mail for at logge ind"}
            {mode === "otp-code" && "Indtast koden vi sendte til din e-mail"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "otp-email" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="dig@pluskontoret.dk"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sender..." : "Send login-kode"}
                </Button>
              </>
            )}

            {mode === "otp-code" && (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Vi har sendt en 6-cifret kode til <strong>{email}</strong>. Tjek også spam-mappen.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="otp">Login-kode</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(v) => setOtpCode(v)}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || otpCode.length !== 6}>
                  {isLoading ? "Logger ind..." : "Log ind"}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("otp-email");
                      setOtpCode("");
                    }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Skift e-mail
                  </button>
                  <button
                    type="button"
                    onClick={() => sendOtp(true)}
                    disabled={resendCountdown > 0 || isLoading}
                    className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCountdown > 0 ? `Send ny kode (${resendCountdown}s)` : "Send ny kode"}
                  </button>
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
