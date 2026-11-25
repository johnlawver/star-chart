export type Period = "day" | "week";

/**
 * When the current day or week began, in a chart's time zone: local midnight, or Monday's local midnight for a week.
 * Using the chart's own time zone (not the server's) means a day ends at the family's midnight, daylight saving included.
 */
export function startOfPeriod(now: Date, timeZone: string, period: Period): Date {
  const local = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone);
  const day = period === "week" ? local.subtract({ days: local.dayOfWeek - 1 }) : local;
  return new Date(day.startOfDay().epochMilliseconds);
}

/**
 * The next time it's the given hour (on the hour) in a time zone, strictly after now. Daylight saving is followed, so
 * it's always the family's own 3am, whatever the offset that night.
 */
export function nextLocalHour(now: Date, timeZone: string, hour: number): Date {
  const local = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone);
  let next = local.startOfDay().with({ hour });
  if (Temporal.ZonedDateTime.compare(next, local) <= 0) next = local.startOfDay().add({ days: 1 }).with({ hour });
  return new Date(next.epochMilliseconds);
}
