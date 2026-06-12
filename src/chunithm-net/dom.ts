import type { HTMLElement } from 'node-html-parser'

export function qs(root: HTMLElement, sel: string, fb = ''): string {
    return root.querySelector(sel)?.text?.trim() || fb
}
