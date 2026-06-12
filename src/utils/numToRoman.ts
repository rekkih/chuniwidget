export function numToRoman(num: number): string {
    const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
    return romanNumerals[num] ?? ''
}
