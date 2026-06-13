import { parseJstDate } from './parseJstDate'

export function formatRelativeDate(date: Date): string {
    const diffMs = Date.now() - date.getTime()
    if (diffMs < 0) return 'just now'
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths >= 1) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
    if (diffDays >= 1) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    if (diffHours >= 1) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffMinutes >= 1) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
    return 'just now'
}

export function formatRelativeTime(dateString: string): string {
    const parsed = parseJstDate(dateString)
    if (!parsed) return 'Never'
    return formatRelativeDate(parsed)
}
