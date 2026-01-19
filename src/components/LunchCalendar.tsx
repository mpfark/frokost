import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfWeek, getWeek } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Users, UserPlus, Plus, Trash2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Guest {
  id: string;
  signup_id: string;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  is_vegetarian: boolean;
}

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
  guest_count: number;
  marked_absent_at: string | null;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface ClosedDate {
  id: string;
  date: string;
  reason: string | null;
}

interface LunchOptout {
  id: string;
  user_id: string;
  lunch_date: string;
}

const SETTINGS_CACHE_KEY = "company_settings_cache";

export const LunchCalendar = ({ userId }: { userId: string }) => {
  // Try to get cached weeks setting for instant render
  const getCachedWeeks = () => {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.weeks_to_display || 4;
      } catch {
        return 4;
      }
    }
    return null; // null means we need to load
  };

  const cachedWeeks = getCachedWeeks();
  
  const [signups, setSignups] = useState<LunchSignup[]>([]);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [optouts, setOptouts] = useState<LunchOptout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(cachedWeeks === null);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [weeksToDisplay, setWeeksToDisplay] = useState(cachedWeeks || 4);

  const today = new Date();
  const currentWeekNumber = getWeek(today, { weekStartsOn: 1 });
  const startDate = startOfWeek(today, { weekStartsOn: 1 });

  // Create weeks of data based on company settings
  const weeks = Array.from({ length: weeksToDisplay }, (_, weekIndex) => {
    const weekStart = addDays(startDate, weekIndex * 7);
    const weekNumber = getWeek(weekStart, { weekStartsOn: 1 });
    const days = Array.from({ length: 5 }, (_, dayIndex) => 
      addDays(weekStart, dayIndex)
    );
    return { weekNumber, days };
  });

  const fetchSignups = async () => {
    const endDate = addDays(startDate, (weeksToDisplay * 7) - 1);
    const { data, error } = await supabase
      .from("lunch_signups")
      .select("*, profiles(full_name, email)")
      .gte("lunch_date", format(startDate, "yyyy-MM-dd"))
      .lte("lunch_date", format(endDate, "yyyy-MM-dd"));

    if (error) {
      toast.error("Kunne ikke indlæse tilmeldinger");
      return;
    }

    setSignups(data || []);
  };

  const getUserSignup = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.find((s) => s.lunch_date === dateStr && s.user_id === userId);
  };

  const fetchClosedDates = async () => {
    const endDate = addDays(startDate, (weeksToDisplay * 7) - 1);
    const { data, error } = await supabase
      .from("closed_dates")
      .select("*")
      .gte("date", format(startDate, "yyyy-MM-dd"))
      .lte("date", format(endDate, "yyyy-MM-dd"));

    if (error) {
      toast.error("Kunne ikke indlæse lukkede dage");
      return;
    }

    setClosedDates(data || []);
  };

  const fetchOptouts = async () => {
    const endDate = addDays(startDate, (weeksToDisplay * 7) - 1);
    const { data, error } = await supabase
      .from("lunch_optouts")
      .select("*")
      .eq("user_id", userId)
      .gte("lunch_date", format(startDate, "yyyy-MM-dd"))
      .lte("lunch_date", format(endDate, "yyyy-MM-dd"));

    if (error) {
      console.error("Kunne ikke indlæse frameldinger:", error);
      return;
    }

    setOptouts(data || []);
  };

  const fetchGuests = async () => {
    const signupIds = signups.map(s => s.id);
    if (signupIds.length === 0) return;

    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .in("signup_id", signupIds);

    if (error) {
      toast.error("Kunne ikke indlæse gæster");
      return;
    }

    setGuests(data || []);
  };

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("weeks_to_display")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching company settings:", error);
        return;
      }

      if (data) {
        const weeks = data.weeks_to_display || 4;
        setWeeksToDisplay(weeks);
        // Cache settings for next load
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ weeks_to_display: weeks }));
      }
    } finally {
      setIsSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  useEffect(() => {
    if (weeksToDisplay > 0) {
      fetchSignups();
      fetchClosedDates();
      fetchOptouts();
    }
  }, [weeksToDisplay]);

  useEffect(() => {
    if (signups.length > 0) {
      fetchGuests();
    }
  }, [signups]);

  useEffect(() => {
    const signupsChannel = supabase
      .channel("lunch_signups_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lunch_signups",
        },
        () => {
          fetchSignups();
        }
      )
      .subscribe();

    const closedDatesChannel = supabase
      .channel("closed_dates_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "closed_dates",
        },
        () => {
          fetchClosedDates();
        }
      )
      .subscribe();

    const guestsChannel = supabase
      .channel("guests_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
        },
        () => {
          fetchSignups();
          fetchGuests();
        }
      )
      .subscribe();

    const optoutsChannel = supabase
      .channel("lunch_optouts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lunch_optouts",
        },
        () => {
          fetchOptouts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(signupsChannel);
      supabase.removeChannel(closedDatesChannel);
      supabase.removeChannel(guestsChannel);
      supabase.removeChannel(optoutsChannel);
    };
  }, []);

  const isSignedUp = (date: Date) => {
    return getUserSignup(date) !== undefined;
  };

  const isOptedOut = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return optouts.some((o) => o.lunch_date === dateStr);
  };

  const getSignupsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return signups.filter((s) => s.lunch_date === dateStr);
  };

  const getTotalPeopleForDate = (date: Date) => {
    const daySignups = getSignupsForDate(date);
    // Filter out absent people - employees only see expected count
    const presentSignups = daySignups.filter(s => !s.marked_absent_at);
    return presentSignups.length + presentSignups.reduce((sum, s) => sum + s.guest_count, 0);
  };

  const toggleSignup = async (date: Date) => {
    const userSignup = getUserSignup(date);
    setIsLoading(true);
    
    try {
      if (userSignup) {
        // Cancel signup
        const { error } = await supabase
          .from("lunch_signups")
          .delete()
          .eq("id", userSignup.id);

        if (error) throw error;
        await fetchSignups();
        toast.success("Frokosttilmelding annulleret");
      } else {
        // Remove any optout first if exists
        const dateStr = format(date, "yyyy-MM-dd");
        if (isOptedOut(date)) {
          await supabase
            .from("lunch_optouts")
            .delete()
            .eq("user_id", userId)
            .eq("lunch_date", dateStr);
        }
        
        // Sign up with 0 guests initially
        const { error } = await supabase
          .from("lunch_signups")
          .insert({ 
            user_id: userId, 
            lunch_date: dateStr,
            guest_count: 0
          });

        if (error) throw error;
        await fetchSignups();
        await fetchOptouts();
        toast.success("Tilmeldt til frokost!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOptout = async (date: Date) => {
    setIsLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");
    
    try {
      if (isOptedOut(date)) {
        // Remove optout
        const { error } = await supabase
          .from("lunch_optouts")
          .delete()
          .eq("user_id", userId)
          .eq("lunch_date", dateStr);

        if (error) throw error;
        await fetchOptouts();
        toast.success("Framelding fjernet");
      } else {
        // First remove any signup if exists
        const userSignup = getUserSignup(date);
        if (userSignup) {
          await supabase
            .from("lunch_signups")
            .delete()
            .eq("id", userSignup.id);
        }
        
        // Add optout
        const { error } = await supabase
          .from("lunch_optouts")
          .insert({ 
            user_id: userId, 
            lunch_date: dateStr
          });

        if (error) throw error;
        await fetchSignups();
        await fetchOptouts();
        toast.success("Frameldt til frokost");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getGuestsForSignup = (signupId: string) => {
    return guests.filter(g => g.signup_id === signupId);
  };

  const addGuest = async (signupId: string) => {
    setIsLoading(true);
    try {
      // Get current guest count
      const signup = signups.find(s => s.id === signupId);
      if (!signup) throw new Error("Signup not found");

      // Insert guest
      const { error: guestError } = await supabase
        .from("guests")
        .insert({
          signup_id: signupId,
          is_gluten_free: false,
          is_lactose_free: false,
          is_vegetarian: false,
        });

      if (guestError) throw guestError;

      // Update guest count
      const { error: updateError } = await supabase
        .from("lunch_signups")
        .update({ guest_count: signup.guest_count + 1 })
        .eq("id", signupId);

      if (updateError) throw updateError;

      await fetchSignups();
      toast.success("Gæst tilføjet");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const removeGuest = async (guestId: string) => {
    setIsLoading(true);
    try {
      // Find the guest to get signup_id
      const guest = guests.find(g => g.id === guestId);
      if (!guest) throw new Error("Guest not found");

      // Find the signup to get current guest count
      const signup = signups.find(s => s.id === guest.signup_id);
      if (!signup) throw new Error("Signup not found");

      // Delete guest
      const { error: deleteError } = await supabase
        .from("guests")
        .delete()
        .eq("id", guestId);

      if (deleteError) throw deleteError;

      // Update guest count
      const { error: updateError } = await supabase
        .from("lunch_signups")
        .update({ guest_count: Math.max(0, signup.guest_count - 1) })
        .eq("id", guest.signup_id);

      if (updateError) throw updateError;

      await fetchSignups();
      toast.success("Gæst fjernet");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateGuestRestrictions = async (
    guestId: string,
    field: "is_gluten_free" | "is_lactose_free" | "is_vegetarian",
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("guests")
        .update({ [field]: value })
        .eq("id", guestId);

      if (error) throw error;
      await fetchGuests();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const isPastDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return dateStr < todayStr;
  };

  const isDateClosed = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return closedDates.some((cd) => cd.date === dateStr);
  };

  const getClosedReason = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return closedDates.find((cd) => cd.date === dateStr)?.reason;
  };

  const hasAvailableDays = (days: Date[]) => {
    return days.some(date => !isPastDate(date) && !isDateClosed(date));
  };

  const signupForWeek = async (days: Date[]) => {
    setIsLoading(true);
    try {
      const eligibleDays = days.filter(date => 
        !isPastDate(date) && 
        !isDateClosed(date) && 
        !isSignedUp(date)
      );
      
      if (eligibleDays.length === 0) {
        toast.info("Du er allerede tilmeldt alle tilgængelige dage");
        return;
      }

      for (const date of eligibleDays) {
        const dateStr = format(date, "yyyy-MM-dd");
        
        // Remove any optout first if exists
        if (isOptedOut(date)) {
          await supabase
            .from("lunch_optouts")
            .delete()
            .eq("user_id", userId)
            .eq("lunch_date", dateStr);
        }
        
        await supabase
          .from("lunch_signups")
          .insert({ 
            user_id: userId, 
            lunch_date: dateStr,
            guest_count: 0
          });
      }
      
      await fetchSignups();
      await fetchOptouts();
      toast.success(`Tilmeldt til ${eligibleDays.length} dag${eligibleDays.length > 1 ? 'e' : ''}`);
    } catch (error: any) {
      toast.error("Kunne ikke tilmelde hele ugen");
    } finally {
      setIsLoading(false);
    }
  };

  const optoutForWeek = async (days: Date[]) => {
    setIsLoading(true);
    try {
      const eligibleDays = days.filter(date => 
        !isPastDate(date) && 
        !isDateClosed(date) && 
        !isOptedOut(date)
      );
      
      if (eligibleDays.length === 0) {
        toast.info("Du er allerede frameldt alle tilgængelige dage");
        return;
      }

      for (const date of eligibleDays) {
        const dateStr = format(date, "yyyy-MM-dd");
        
        // First remove any signup if exists
        const userSignup = getUserSignup(date);
        if (userSignup) {
          await supabase
            .from("lunch_signups")
            .delete()
            .eq("id", userSignup.id);
        }
        
        await supabase
          .from("lunch_optouts")
          .insert({ 
            user_id: userId, 
            lunch_date: dateStr
          });
      }
      
      await fetchSignups();
      await fetchOptouts();
      toast.success(`Frameldt ${eligibleDays.length} dag${eligibleDays.length > 1 ? 'e' : ''}`);
    } catch (error: any) {
      toast.error("Kunne ikke framelde hele ugen");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSettingsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Skeleton className="h-20 w-20 rounded-lg" />
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <Skeleton key={j} className="h-24 rounded-lg" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {weeks.map(({ weekNumber, days }) => (
        <Card key={weekNumber}>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Week Number */}
              <div className={`flex-shrink-0 flex flex-row md:flex-col items-center justify-center rounded-lg px-4 py-2 md:min-w-[80px] gap-2 md:gap-0 ${weekNumber === currentWeekNumber ? "bg-primary" : "bg-muted"}`}>
                <div className={`text-xs uppercase tracking-wide ${weekNumber === currentWeekNumber ? "text-primary-foreground" : "text-muted-foreground"}`}>Uge</div>
                <div className={`text-2xl md:text-4xl font-bold ${weekNumber === currentWeekNumber ? "text-primary-foreground" : "text-foreground"}`}>{weekNumber}</div>
              </div>

              {/* Days Grid - including "Hele ugen" as first card */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Hele ugen card */}
                <div className={`border rounded-lg p-3 flex flex-col justify-center min-w-0 overflow-hidden ${!hasAvailableDays(days) ? "opacity-60 bg-muted/50" : "bg-card"}`}>
                  <div className="flex flex-col gap-1 min-w-0">
                    <Button
                      onClick={() => signupForWeek(days)}
                      disabled={isLoading || !hasAvailableDays(days)}
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-center"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Tilmeld
                    </Button>
                    <Button
                      onClick={() => optoutForWeek(days)}
                      disabled={isLoading || !hasAvailableDays(days)}
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs justify-center"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Frameld
                    </Button>
                  </div>
                </div>
              {days.map((date) => {
                  const signedUp = isSignedUp(date);
                  const optedOut = isOptedOut(date);
                  const userSignup = getUserSignup(date);
                  const totalPeople = getTotalPeopleForDate(date);
                  const totalGuests = getSignupsForDate(date).reduce((sum, s) => sum + s.guest_count, 0);
                  const isPast = isPastDate(date);
                  const isClosed = isDateClosed(date);
                  const closedReason = getClosedReason(date);

                  return (
                    <div
                      key={date.toISOString()}
                      className={`border rounded-lg p-3 flex flex-col gap-2 min-w-0 overflow-hidden ${isPast || isClosed ? "opacity-60 bg-muted/50" : "bg-card"}`}
                    >
                      {/* Top Row: Date and Stats */}
                      <div className="flex justify-between items-start">
                        {/* Left: Day and Date */}
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {format(date, "EEEE", { locale: da })}
                          </div>
                          <div className="text-sm font-semibold">
                            {format(date, "MMM d", { locale: da })}
                          </div>
                          {isClosed && (
                          <div className="text-xs text-destructive font-medium mt-1">
                            Lukket
                          </div>
                          )}
                        </div>

                        {/* Right: People Count */}
                        {!isClosed && (
                          <div className="text-right flex flex-col items-end">
                            <div className="flex items-center gap-1 text-xs font-medium">
                              <Users className="w-3 h-3" />
                              <span>{totalPeople}</span>
                            </div>
                            {totalGuests > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {totalGuests} gæst{totalGuests > 1 ? 'er' : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Action Buttons */}
                      <div className="flex gap-1 mt-auto min-w-0">
                        {isPast || isClosed ? (
                          <Button
                            disabled
                            variant="outline"
                            size="sm"
                            className="flex-1 w-0 h-9 text-xs justify-center"
                            title={isClosed ? closedReason || "Kontoret lukket" : ""}
                          >
                            Lukket
                          </Button>
                        ) : signedUp ? (
                          <>
                            {/* Signed up state */}
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 w-0 h-9 text-xs justify-center pointer-events-none"
                              title="Tilmeldt"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={() => toggleOptout(date)}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="flex-1 w-0 h-9 text-xs justify-center"
                              title="Afmeld"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : optedOut ? (
                          <>
                            {/* Opted out state */}
                            <Button
                              onClick={() => toggleSignup(date)}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="flex-1 w-0 h-9 text-xs justify-center"
                              title="Tilmeld"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 w-0 h-9 text-xs justify-center pointer-events-none"
                              title="Frameldt"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {/* Neutral state */}
                            <Button
                              onClick={() => toggleSignup(date)}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="flex-1 w-0 h-9 text-xs justify-center"
                            >
                              Tilmeld
                            </Button>
                            <Button
                              onClick={() => toggleOptout(date)}
                              disabled={isLoading}
                              variant="outline"
                              size="sm"
                              className="flex-1 w-0 h-9 text-xs justify-center"
                              title="Afmeld"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        )}

                        {/* Guest Management Dialog - Only show when signed up */}
                        {signedUp && !isPast && !isClosed && userSignup && (
                          <Dialog
                            open={openDialog === date.toISOString()}
                            onOpenChange={(open) => setOpenDialog(open ? date.toISOString() : null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant={userSignup.guest_count > 0 ? "default" : "outline"}
                                size="sm"
                                className="flex-1 w-0 h-9 text-xs justify-center"
                              >
                                <UserPlus className="w-3 h-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Administrer gæster til {format(date, "d. MMM")}</DialogTitle>
                                <DialogDescription>
                                  Tilføj gæster og angiv deres kostbegrænsninger
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                {getGuestsForSignup(userSignup.id).map((guest, index) => (
                                  <Card key={guest.id} className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                      <h4 className="font-medium">Gæst {index + 1}</h4>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeGuest(guest.id)}
                                        disabled={isLoading}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`gluten-${guest.id}`}
                                          checked={guest.is_gluten_free}
                                          onCheckedChange={(checked) =>
                                            updateGuestRestrictions(guest.id, "is_gluten_free", checked as boolean)
                                          }
                                        />
                                        <Label htmlFor={`gluten-${guest.id}`}>Glutenfri</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`lactose-${guest.id}`}
                                          checked={guest.is_lactose_free}
                                          onCheckedChange={(checked) =>
                                            updateGuestRestrictions(guest.id, "is_lactose_free", checked as boolean)
                                          }
                                        />
                                        <Label htmlFor={`lactose-${guest.id}`}>Laktosefri</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`vegetarian-${guest.id}`}
                                          checked={guest.is_vegetarian}
                                          onCheckedChange={(checked) =>
                                            updateGuestRestrictions(guest.id, "is_vegetarian", checked as boolean)
                                          }
                                        />
                                        <Label htmlFor={`vegetarian-${guest.id}`}>Vegetar</Label>
                                      </div>
                                    </div>
                                  </Card>
                                ))}

                                <Button
                                  onClick={() => addGuest(userSignup.id)}
                                  disabled={isLoading || userSignup.guest_count >= 10}
                                  variant="outline"
                                  className="w-full"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Tilføj gæst
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
