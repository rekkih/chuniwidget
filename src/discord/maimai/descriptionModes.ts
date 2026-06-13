import type { PlayerData } from '@/maimai-net'

export type DescriptionMode = 'title' | 'none'

export const DEFAULT_DESCRIPTION_MODE: DescriptionMode = 'title'

export const DESCRIPTION_MODES: Record<DescriptionMode, {
    label: string
    description: string
    build(p: PlayerData): string
}> = {
    title: { label: 'Title', description: 'Your current title', build: p => p.title || 'Newbie' },
    none: { label: 'None', description: 'Hide the description', build: () => ' ' },
}

export function isDescriptionMode(v: string): v is DescriptionMode {
    return v in DESCRIPTION_MODES
}

export function buildDescription(mode: DescriptionMode | null, p: PlayerData): string {
    const m = mode && isDescriptionMode(mode) ? mode : DEFAULT_DESCRIPTION_MODE
    return DESCRIPTION_MODES[m].build(p)
}
