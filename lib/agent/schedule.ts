const LOCAL_TIMEZONE_OFFSET = "+08:00";
const LOCAL_OFFSET_HOURS = 8;

export function inferAgentScheduleAt(
  message: string,
  options: { now?: Date } = {}
): string | undefined {
  const iso = message.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[zZ]|[+-]\d{2}:\d{2})?/);
  if (iso?.[0]) {
    return /[zZ]$|[+-]\d{2}:\d{2}$/.test(iso[0]) ? iso[0] : `${iso[0]}${LOCAL_TIMEZONE_OFFSET}`;
  }

  const relative = message.match(
    /(今晚|今天|明天|后天)?\s*([0-9]{1,2}|[一二三四五六七八九十两]+)\s*点\s*(半|[0-9]{1,2}\s*分?)?/
  );
  if (!relative) {
    return undefined;
  }

  const now = options.now ?? new Date();
  const relativeDay = relative[1] ?? "";
  const parsedHour = parseHour(relative[2]);
  if (parsedHour === null || parsedHour > 23) {
    return undefined;
  }
  const hour = shouldUseEveningHour(message, relativeDay, parsedHour) ? parsedHour + 12 : parsedHour;
  const minute = parseMinute(relative[3]);
  let dayOffset = relativeDay === "后天" ? 2 : relativeDay === "明天" ? 1 : 0;

  let scheduleAt = buildLocalTimestamp(now, dayOffset, hour, minute);
  if ((relativeDay === "" || relativeDay === "今晚" || relativeDay === "今天") && Date.parse(scheduleAt) <= now.getTime()) {
    dayOffset += 1;
    scheduleAt = buildLocalTimestamp(now, dayOffset, hour, minute);
  }

  return scheduleAt;
}

function shouldUseEveningHour(message: string, relativeDay: string, hour: number): boolean {
  return hour <= 11 && /(今晚|晚上|夜里|下午)/.test(`${relativeDay}${message}`);
}

function parseHour(raw: string): number | null {
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const value = parseChineseNumber(raw);
  return value > 0 ? value : null;
}

function parseMinute(raw?: string): number {
  if (!raw) return 0;
  if (raw.includes("半")) return 30;
  const digit = raw.match(/\d{1,2}/);
  return digit ? Number(digit[0]) : 0;
}

function parseChineseNumber(raw: string): number {
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };

  if (raw === "十") return 10;
  if (raw.startsWith("十")) return 10 + (digits[raw.slice(1)] ?? 0);
  if (raw.endsWith("十")) return (digits[raw[0]] ?? 0) * 10;
  if (raw.includes("十")) {
    const [tens, ones] = raw.split("十");
    return (digits[tens] ?? 1) * 10 + (digits[ones] ?? 0);
  }

  return digits[raw] ?? 0;
}

function buildLocalTimestamp(now: Date, dayOffset: number, hour: number, minute: number): string {
  const parts = getLocalParts(now);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth() + 1;
  const date = day.getUTCDate();

  return `${year}-${pad(month)}-${pad(date)}T${pad(hour)}:${pad(minute)}:00${LOCAL_TIMEZONE_OFFSET}`;
}

function getLocalParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + LOCAL_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
