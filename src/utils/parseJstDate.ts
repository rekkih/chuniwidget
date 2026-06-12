// CHUNITHM-NET timestamps are always Japan Standard Time (UTC+9, no DST).
// Parse "YYYY/MM/DD HH:MM" as JST so behavior is independent of the host timezone.
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export function parseJstDate(dateString: string): Date | null {
    const m = dateString.trim().match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/)
    if (!m) return null
    const [, year, month, day, hours, minutes] = m
    return new Date(Date.UTC(+year, +month - 1, +day, +hours, +minutes) - JST_OFFSET_MS)
}
