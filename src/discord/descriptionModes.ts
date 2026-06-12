import type {PlayerProfile} from '@/chunithm-net'

export type DescriptionMode = 'title' | 'team' | 'team_title'

export const DEFAULT_DESCRIPTION_MODE: DescriptionMode = 'title'

// Add a new mode = add one entry here. Used by both the picker UI and the renderer.
export const DESCRIPTION_MODES: Record<DescriptionMode, {
    label: string
    description: string
    build(p: PlayerProfile): string
}> = {
    title: {label: 'Title', description: 'Your title', build: p => p.title || 'NEW COMER'},
    team: {label: 'Team', description: 'Your team name', build: p => p.teamName || 'NO TEAM'},
    team_title: {label: 'Team + Title', description: 'Team name and title', build: p => [p.teamName, p.title].filter(Boolean).join(' · ') || 'NEW COMER'},
}

export function isDescriptionMode(v: string): v is DescriptionMode {
    return v in DESCRIPTION_MODES
}

export function buildDescription(mode: DescriptionMode | null, p: PlayerProfile): string {
    const m = mode && isDescriptionMode(mode) ? mode : DEFAULT_DESCRIPTION_MODE
    return DESCRIPTION_MODES[m].build(p)
}
