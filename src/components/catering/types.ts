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
  attendeeEmails?: string[];
  externalMeetingId?: string | null;
}

export interface ExistingOrder {
  status: string;
  id: string;
  person_count: number;
  catering_types: string[];
  comment: string | null;
  user_id: string;
  orderer_name: string | null;
  meeting_external_id?: string | null;
}
