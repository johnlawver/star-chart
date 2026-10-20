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
