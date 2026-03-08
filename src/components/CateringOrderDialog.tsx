import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UtensilsCrossed } from "lucide-react";

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
}

const CATERING_OPTIONS = [
  { id: "coffee_tea", label: "Kaffe & te" },
  { id: "water_juice", label: "Vand & juice" },
  { id: "fruit", label: "Frugt" },
  { id: "pastry", label: "Morgenmad / wienerbrød" },
  { id: "sandwich", label: "Sandwich" },
  { id: "cake", label: "Kage" },
  { id: "lunch", label: "Frokost" },
] as const;

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarisk" },
  { id: "gluten_free", label: "Glutenfri" },
  { id: "lactose_free", label: "Laktosefri" },
  { id: "vegan", label: "Vegansk" },
] as const;

export const CateringOrderDialog = ({ open, onOpenChange, meeting }: CateringOrderDialogProps) => {
  const [personCount, setPersonCount] = useState(meeting.attendeeCount || 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleDietary = (id: string) => {
    setSelectedDietary((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
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

      const { error } = await supabase.from("catering_orders").insert({
        user_id: user.id,
        meeting_subject: meeting.subject.slice(0, 200),
        meeting_date: meeting.date,
        meeting_time: meeting.time,
        meeting_location: meeting.location?.slice(0, 200) || null,
        person_count: personCount,
        catering_types: selectedTypes,
        dietary_notes: selectedDietary.length > 0 ? selectedDietary.join(", ") : null,
        comment: comment.trim().slice(0, 500) || null,
      });

      if (error) throw error;

      toast.success("Forplejning bestilt!");
      onOpenChange(false);
      // Reset form
      setSelectedTypes([]);
      setSelectedDietary([]);
      setComment("");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke bestille forplejning");
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
            Bestil forplejning
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

          {/* Dietary needs */}
          <div className="space-y-2">
            <Label>Diætønsker (valgfrit)</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedDietary.includes(option.id)}
                    onCheckedChange={() => toggleDietary(option.id)}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annullér
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedTypes.length === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Bestiller...
              </>
            ) : (
              "Bestil forplejning"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
