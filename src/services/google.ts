import { google, type calendar_v3 } from 'googleapis';

import type { AppConfig } from '../config';
import { toEventTimes } from '../lib/datetime';

export interface Appointment {
  title: string;
  /** Raw Pockey due-time string (naive, absolute, or date-only). */
  due: string;
  location?: string;
  notes?: string;
}

export interface CreatedEvent {
  id: string;
  htmlLink?: string | null;
}

/**
 * Thin wrapper around the Google Calendar API. Uses an OAuth2 client seeded
 * with a long-lived refresh token; googleapis mints/refreshes access tokens
 * automatically per request.
 */
export class GoogleCalendarService {
  private readonly calendar: calendar_v3.Calendar;
  private readonly calendarId: string;
  private readonly timezone: string;
  private readonly defaultDurationMin: number;

  constructor(cfg: AppConfig) {
    const auth = new google.auth.OAuth2({
      clientId: cfg.google.clientId,
      clientSecret: cfg.google.clientSecret,
      redirectUri: cfg.google.redirectUri,
    });
    auth.setCredentials({ refresh_token: cfg.google.refreshToken });

    this.calendar = google.calendar({ version: 'v3', auth });
    this.calendarId = cfg.google.calendarId;
    this.timezone = cfg.timezone;
    this.defaultDurationMin = cfg.google.defaultEventDurationMinutes;
  }

  async createEvent(appt: Appointment): Promise<CreatedEvent> {
    const times = toEventTimes(appt.due, this.defaultDurationMin);

    const requestBody: calendar_v3.Schema$Event = {
      summary: appt.title,
      ...(appt.location ? { location: appt.location } : {}),
      ...(appt.notes ? { description: appt.notes } : {}),
      start: times.allDay
        ? { date: times.start }
        : { dateTime: times.start, timeZone: this.timezone },
      end: times.allDay
        ? { date: times.end }
        : { dateTime: times.end, timeZone: this.timezone },
    };

    const res = await this.calendar.events.insert({
      calendarId: this.calendarId,
      requestBody,
    });

    return { id: res.data.id ?? '', htmlLink: res.data.htmlLink };
  }
}
