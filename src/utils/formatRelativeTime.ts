function parseDateString(dateString: string): Date {
    const [datePart, timePart] = dateString.split(' ')
    if (!datePart || !timePart) {
        throw new Error(`Invalid date format: ${dateString}. Expected YYYY/MM/DD HH:MM`)
    }
    const [year, month, day] = datePart.split('/').map(Number)
    const [hours, minutes] = timePart.split(':').map(Number)
    if ([year, month, day, hours, minutes].some(isNaN)) {
        throw new Error(`Invalid date format: ${dateString}. Expected YYYY/MM/DD HH:MM`)
    }
    return new Date(year, month - 1, day, hours, minutes)
}

export function formatRelativeTime(dateString: string): string {
    const diffMs = Date.now() - parseDateString(dateString).getTime()
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
