/**
 * Shared Graph API event mapping utilities.
 */

/** Map a raw Microsoft Graph event to a normalized event object. */
export function mapGraphEvent(event: any) {
  const nonResourceAttendees = (event.attendees || []).filter(
    (a: any) => a.type !== "resource"
  );
  return {
    id: event.id,
    subject: event.subject,
    startTime: event.start?.dateTime,
    startTimezone: event.start?.timeZone,
    endTime: event.end?.dateTime,
    endTimezone: event.end?.timeZone,
    location: event.location?.displayName || null,
    isAllDay: event.isAllDay,
    organizer: event.organizer?.emailAddress?.name || null,
    attendeeCount: nonResourceAttendees.length,
    attendeeEmails: nonResourceAttendees
      .map((a: any) => a.emailAddress?.address?.toLowerCase())
      .filter(Boolean),
    externalMeetingId: event.iCalUId || null,
  };
}
