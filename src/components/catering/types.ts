export interface CalendarEvent {
  id: string;
  subject: string;
  startTime: string;
  startTimezone: string;
  endTime: string;
  endTimezone: string;
  location: string | null;
  isAllDay: boolean;
  organizer: string | null;
  attendeeCount: number;
}

export interface ExistingOrder {
  status: string;
  id: string;
  person_count: number;
  catering_types: string[];
  dietary_notes: string | null;
  comment: string | null;
  user_id: string;
  orderer_name: string | null;
}
