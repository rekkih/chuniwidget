import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const rawKey = process.env.TOKEN_ENCRYPTION_KEY
if (!rawKey) {
    console.error('Missing TOKEN_ENCRYPTION_KEY in environment')
    process.exit(1)
}

const key = Buffer.from(rawKey, 'base64')
if (key.length !== 32) {
    console.error('TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded). Generate one with: openssl rand -base64 32')
    process.exit(1)
}

const IV_BYTES = 12

export function encryptSecret(plain: string): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptSecret(blob: string): string {
    const [ivB64, tagB64, ctB64] = blob.split(':')
    if (!ivB64 || !tagB64 || !ctB64) {
        throw new Error('Malformed encrypted secret')
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}
