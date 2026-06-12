import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    discordId: text('discord_id').primaryKey(),
    segaId: text('sega_id').notNull(),
    externalId: text('external_id'),
    chuniToken: text('chuni_token').notNull(),
    descriptionMode: text('description_mode').notNull().default('title'),
    convertWidth: boolean('convert_width').notNull().default(true),
    linkedAt: timestamp('linked_at', {withTimezone: true}).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', {withTimezone: true}),
    lastPlayedAt: timestamp('last_played_at', {withTimezone: true}),
})

export type User = typeof users.$inferSelect;

export const loginAttempts = pgTable('login_attempts', {
    discordId: text('discord_id').primaryKey(),
    count: integer('count').notNull().default(0),
    windowStart: timestamp('window_start', {withTimezone: true}).notNull().defaultNow(),
})
