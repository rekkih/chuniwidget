/**
 * Converts full-width characters (ASCII range U+FF01-FF5E and the ideographic
 * space U+3000) to their regular half-width equivalents. Leaves everything else
 * untouched.
 */
export function toHalfWidth(str: string): string {
    return str
        .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/　/g, ' ')
}
