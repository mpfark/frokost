import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UtensilsCrossed } from "lucide-react";
import { normalizeMeetingTime } from "@/components/catering/orderKey";

interface CateringOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: {
    subject: string;
    date: string;
    time: string;
    location?: string;
    attendeeCount: number;
  };
  existingOrder?: {
    id: string;
    person_count: number;
    catering_types: string[];
    comment: string | null;
  } | null;
}

const CATERING_OPTIONS = [
  { id: "coffee_tea", label: "Kaffe og te" },
  { id: "water", label: "Vand" },
  { id: "fruit", label: "Frugt" },
  { id: "pastry", label: "Morgenbrød" },
  { id: "cake", label: "Kage" },
] as const;

export const CateringOrderDialog = ({ open, onOpenChange, meeting, existingOrder }: CateringOrderDialogProps) => {
  const isEditing = !!existingOrder;

  const [personCount, setPersonCount] = useState(meeting.attendeeCount || 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [addToLunch, setAddToLunch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && existingOrder) {
      setPersonCount(existingOrder.person_count);
      setSelectedTypes(existingOrder.catering_types);
      setComment(existingOrder.comment || "");
      setAddToLunch(false);
    } else if (open && !existingOrder) {
      setPersonCount(meeting.attendeeCount || 1);
      setSelectedTypes([]);
      setComment("");
      setAddToLunch(false);
    }
  }, [open, existingOrder]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const addGuestsToLunch = async (userId: string, orderId: string, guestCount: number, lunchDate: string) => {
    // Ensure user has a lunch signup for this date
    let { data: signup } = await supabase
      .from("lunch_signups")
      .select("id")
      .eq("user_id", userId)
      .eq("lunch_date", lunchDate)
      .maybeSingle();

    if (!signup) {
      const { data: newSignup, error: signupErr } = await supabase
        .from("lunch_signups")
        .insert({ user_id: userId, lunch_date: lunchDate })
        .select("id")
        .single();
      if (signupErr) throw signupErr;
      signup = newSignup;
    }

    // Remove any opt-out for this date
    await supabase
      .from("lunch_optouts")
      .delete()
      .eq("user_id", userId)
      .eq("lunch_date", lunchDate);

    // Add guests linked to the catering order
    const guests = Array.from({ length: guestCount }, () => ({
      signup_id: signup!.id,
      catering_order_id: orderId,
    }));

    if (guests.length > 0) {
      const { error: guestErr } = await supabase.from("guests").insert(guests);
      if (guestErr) throw guestErr;
    }
  };

  const handleSubmit = async () => {
    if (selectedTypes.length === 0) {
      toast.error("Vælg mindst én type forplejning");
      return;
    }

    if (personCount < 1 || personCount > 500) {
      toast.error("Antal personer skal være mellem 1 og 500");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");

      const normalizedMeetingTime = normalizeMeetingTime(meeting.time);
      const normalizedMeetingLocation = meeting.location?.trim().replace(/\s+/g, " ").slice(0, 200) || null;

      const orderData = {
        person_count: personCount,
        catering_types: selectedTypes,
        comment: comment.trim().slice(0, 500) || null,
      };

      let orderId: string;

      if (isEditing) {
        const { error } = await supabase
          .from("catering_orders")
          .update({ ...orderData, status: "pending" })
          .eq("id", existingOrder.id);
        if (error) throw error;
        orderId = existingOrder.id;
        toast.success("Bestilling opdateret!");
      } else {
        let existingOrderQuery = supabase
          .from("catering_orders")
          .select("id")
          .eq("meeting_date", meeting.date)
          .eq("meeting_time", normalizedMeetingTime)
          .in("status", ["pending", "confirmed"]);

        existingOrderQuery = normalizedMeetingLocation
          ? existingOrderQuery.eq("meeting_location", normalizedMeetingLocation)
          : existingOrderQuery.is("meeting_location", null);

        const { data: matchingOrders, error: matchingError } = await existingOrderQuery
          .order("created_at", { ascending: false })
          .limit(1);

        if (matchingError) throw matchingError;

        const existingActiveOrderId = matchingOrders?.[0]?.id;

        if (existingActiveOrderId) {
          const { error } = await supabase
            .from("catering_orders")
            .update({ ...orderData, status: "pending" })
            .eq("id", existingActiveOrderId);
          if (error) throw error;
          orderId = existingActiveOrderId;
          toast.success("Bestilling opdateret!");
        } else {
          const { data, error } = await supabase
            .from("catering_orders")
            .insert({
              ...orderData,
              user_id: user.id,
              meeting_subject: meeting.subject.slice(0, 200),
              meeting_date: meeting.date,
              meeting_time: normalizedMeetingTime,
              meeting_location: normalizedMeetingLocation,
            })
            .select("id")
            .single();
          if (error) throw error;
          orderId = data.id;
          toast.success("Forplejning bestilt!");
        }
      }

      // Add guests to lunch if requested (subtract 1 for the organizer who is already signed up)
      const guestCount = personCount - 1;
      if (addToLunch && guestCount > 0) {
        try {
          await addGuestsToLunch(user.id, orderId, guestCount, meeting.date);
          toast.success(`${guestCount} gæst${guestCount > 1 ? "er" : ""} tilføjet til frokost`);
        } catch (err: any) {
          toast.error("Kunne ikke tilføje gæster til frokost: " + (err.message || ""));
        }
      }

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke gemme forplejning");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            {isEditing ? "Opdatér forplejning" : "Bestil forplejning"}
          </DialogTitle>
          <DialogDescription>
            {meeting.subject} — {meeting.time}
            {meeting.location && ` · ${meeting.location}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Person count */}
          <div className="space-y-2">
            <Label htmlFor="personCount">Antal personer</Label>
            <Input
              id="personCount"
              type="number"
              min={1}
              max={500}
              value={personCount}
              onChange={(e) => setPersonCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
            />
          </div>

          {/* Catering types */}
          <div className="space-y-2">
            <Label>Type forplejning</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATERING_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedTypes.includes(option.id)}
                    onCheckedChange={() => toggleType(option.id)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Kommentar (valgfrit)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Særlige ønsker..."
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Add to lunch */}
          {!isEditing && (
            <label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors">
              <Checkbox
                checked={addToLunch}
                onCheckedChange={(checked) => setAddToLunch(checked as boolean)}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">Tilføj gæsterne til dagens frokost</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {personCount - 1 > 0
                    ? `${personCount - 1} gæst${personCount - 1 > 1 ? "er" : ""} tilmeldes frokost under dit navn (dig selv fraregnet). De fjernes automatisk hvis bestillingen annulleres.`
                    : "Ingen gæster at tilføje (kun dig selv i mødet)."}
                </p>
              </div>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedTypes.length === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {isEditing ? "Opdaterer..." : "Bestiller..."}
              </>
            ) : (
              isEditing ? "Opdatér bestilling" : "Bestil forplejning"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
