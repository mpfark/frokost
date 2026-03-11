import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Smartphone, Palmtree, CalendarIcon, BellRing, BellOff, LogOut } from "lucide-react";
import { PushSubscriptionButton } from "@/components/PushSubscriptionButton";
import { profileSchema } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays, isWeekend, isBefore, startOfDay, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";

interface ProfileSettingsProps {
  userId: string;
}

export const ProfileSettings = ({ userId }: ProfileSettingsProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fullName, setFullName] = useState("");
  const [isGlutenFree, setIsGlutenFree] = useState(false);
  const [isLactoseFree, setIsLactoseFree] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);

  // Vacation state
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState<Date | undefined>();
  const [vacationEndDate, setVacationEndDate] = useState<Date | undefined>();
  const [isSubmittingVacation, setIsSubmittingVacation] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

      if (error) {
        toast.error("Kunne ikke indlæse profil");
        return;
      }

    if (data) {
      setFullName(data.full_name || "");
      setIsGlutenFree(data.is_gluten_free);
      setIsLactoseFree(data.is_lactose_free);
      setIsVegetarian(data.is_vegetarian);
    }
    setIsFetching(false);
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Validate profile data
      const validationResult = profileSchema.safeParse({
        fullName,
        isGlutenFree,
        isLactoseFree,
        isVegetarian,
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

      if (error) {
        toast.error("Kunne ikke opdatere profil");
      } else {
        toast.success("Profil opdateret med succes!");
      }
    } catch (error) {
      toast.error("Der opstod en fejl under opdatering af profil");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate all weekdays between two dates
  const generateWeekdays = (start: Date, end: Date): string[] => {
    const weekdays: string[] = [];
    let current = startOfDay(start);
    const endDay = startOfDay(end);

    while (!isBefore(endDay, current)) {
      if (!isWeekend(current)) {
        weekdays.push(format(current, "yyyy-MM-dd"));
      }
      current = addDays(current, 1);
    }

    return weekdays;
  };

  const handleVacationSubmit = async () => {
    if (!vacationStartDate || !vacationEndDate) {
      toast.error("Vælg venligst både start- og slutdato");
      return;
    }

    const today = startOfDay(new Date());
    const startDay = startOfDay(vacationStartDate);
    const endDay = startOfDay(vacationEndDate);

    // Validation
    if (isBefore(startDay, today)) {
      toast.error("Startdato kan ikke være i fortiden");
      return;
    }

    if (isBefore(endDay, startDay)) {
      toast.error("Slutdato skal være efter startdato");
      return;
    }

    if (differenceInDays(endDay, today) > 60) {
      toast.error("Du kan maksimalt melde ferie 60 dage frem");
      return;
    }

    setIsSubmittingVacation(true);

    try {
      // Generate all weekdays in the period
      const allWeekdays = generateWeekdays(startDay, endDay);

      if (allWeekdays.length === 0) {
        toast.error("Der er ingen hverdage i den valgte periode");
        setIsSubmittingVacation(false);
        return;
      }

      // Fetch closed dates
      const { data: closedDates } = await supabase
        .from("closed_dates")
        .select("date")
        .gte("date", allWeekdays[0])
        .lte("date", allWeekdays[allWeekdays.length - 1]);

      const closedDateSet = new Set(closedDates?.map(d => d.date) || []);

      // Fetch existing optouts for the user in this period
      const { data: existingOptouts } = await supabase
        .from("lunch_optouts")
        .select("lunch_date")
        .eq("user_id", userId)
        .gte("lunch_date", allWeekdays[0])
        .lte("lunch_date", allWeekdays[allWeekdays.length - 1]);

      const existingOptoutSet = new Set(existingOptouts?.map(o => o.lunch_date) || []);

      // Fetch existing signups for the user in this period
      const { data: existingSignups } = await supabase
        .from("lunch_signups")
        .select("lunch_date")
        .eq("user_id", userId)
        .gte("lunch_date", allWeekdays[0])
        .lte("lunch_date", allWeekdays[allWeekdays.length - 1]);

      const existingSignupSet = new Set(existingSignups?.map(s => s.lunch_date) || []);

      // Filter out closed dates, existing optouts, and existing signups
      const datesToOptout = allWeekdays.filter(date => 
        !closedDateSet.has(date) && 
        !existingOptoutSet.has(date) &&
        !existingSignupSet.has(date)
      );

      if (datesToOptout.length === 0) {
        toast.info("Alle hverdage i perioden er enten lukket, allerede frameldt, eller du er allerede tilmeldt");
        setIsSubmittingVacation(false);
        return;
      }

      // Batch insert optouts
      const optoutsToInsert = datesToOptout.map(date => ({
        user_id: userId,
        lunch_date: date,
      }));

      const { error } = await supabase
        .from("lunch_optouts")
        .insert(optoutsToInsert);

      if (error) {
        console.error("Error inserting vacation optouts:", error);
        toast.error("Kunne ikke gemme ferie");
      } else {
        toast.success(`Ferie registreret! Du er nu frameldt ${datesToOptout.length} dag${datesToOptout.length === 1 ? '' : 'e'}`);
        setVacationDialogOpen(false);
        setVacationStartDate(undefined);
        setVacationEndDate(undefined);
      }
    } catch (error) {
      console.error("Error submitting vacation:", error);
      toast.error("Der opstod en fejl ved registrering af ferie");
    } finally {
      setIsSubmittingVacation(false);
    }
  };

  if (isFetching) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profilindstillinger</CardTitle>
        <CardDescription>Administrer dit navn og dine kostpræferencer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="fullName">Fulde navn</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dit fulde navn"
          />
        </div>

        <div className="space-y-4">
          <Label className="text-base font-semibold">Kostpræferencer</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="gluten"
              checked={isGlutenFree}
              onCheckedChange={(checked) => setIsGlutenFree(checked as boolean)}
            />
            <Label
              htmlFor="gluten"
              className="text-sm font-normal cursor-pointer"
            >
              Glutenfri
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="lactose"
              checked={isLactoseFree}
              onCheckedChange={(checked) => setIsLactoseFree(checked as boolean)}
            />
            <Label
              htmlFor="lactose"
              className="text-sm font-normal cursor-pointer"
            >
              Laktosefri
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="vegetarian"
              checked={isVegetarian}
              onCheckedChange={(checked) => setIsVegetarian(checked as boolean)}
            />
            <Label
              htmlFor="vegetarian"
              className="text-sm font-normal cursor-pointer"
            >
              Vegetar
            </Label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Gemmer...
            </>
          ) : (
            "Gem ændringer"
          )}
        </Button>

        {/* Vacation Section */}
        <div className="pt-4 border-t">
          <Dialog open={vacationDialogOpen} onOpenChange={setVacationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Palmtree className="w-4 h-4 mr-2" />
                Meld ferie
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Meld ferie</DialogTitle>
                <DialogDescription>
                  Vælg en periode, og du bliver automatisk frameldt frokost på alle hverdage.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Startdato</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !vacationStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {vacationStartDate ? (
                          format(vacationStartDate, "PPP", { locale: da })
                        ) : (
                          <span>Vælg startdato</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={vacationStartDate}
                        onSelect={setVacationStartDate}
                        disabled={(date) => 
                          isBefore(startOfDay(date), today) || 
                          isBefore(maxDate, startOfDay(date))
                        }
                        initialFocus
                        locale={da}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Slutdato</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !vacationEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {vacationEndDate ? (
                          format(vacationEndDate, "PPP", { locale: da })
                        ) : (
                          <span>Vælg slutdato</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={vacationEndDate}
                        onSelect={setVacationEndDate}
                        disabled={(date) => {
                          const dateStart = startOfDay(date);
                          return (
                            isBefore(dateStart, vacationStartDate || today) ||
                            isBefore(maxDate, dateStart)
                          );
                        }}
                        initialFocus
                        locale={da}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {vacationStartDate && vacationEndDate && (
                  <p className="text-sm text-muted-foreground">
                    Du melder dig fra frokost i {generateWeekdays(vacationStartDate, vacationEndDate).length} hverdage
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVacationDialogOpen(false);
                    setVacationStartDate(undefined);
                    setVacationEndDate(undefined);
                  }}
                >
                  Annuller
                </Button>
                <Button 
                  onClick={handleVacationSubmit} 
                  disabled={isSubmittingVacation || !vacationStartDate || !vacationEndDate}
                >
                  {isSubmittingVacation ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gemmer...
                    </>
                  ) : (
                    "Gem ferie"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Push Notifications */}
        <div className="pt-4 border-t">
          <PushSubscriptionButton />
        </div>

        <div className="pt-4 border-t">
          <Button asChild variant="outline" className="w-full">
            <Link to="/install" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Installer appen på telefonen
            </Link>
          </Button>
        </div>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Logget ud");
            }}
          >
            <LogOut className="w-4 h-4" />
            Log ud
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
