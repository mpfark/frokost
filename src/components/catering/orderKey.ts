export const normalizeMeetingTime = (meetingTime: string) =>
  meetingTime.replace(/\s*-\s*/g, " - ").trim();

export const normalizeMeetingLocation = (meetingLocation?: string | null) =>
  (meetingLocation ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export const buildMeetingOrderKey = (
  meetingDate: string,
  meetingTime: string,
  meetingLocation?: string | null,
) => `${meetingDate}|${normalizeMeetingTime(meetingTime)}|${normalizeMeetingLocation(meetingLocation)}`;
