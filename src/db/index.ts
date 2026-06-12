import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in environment')
    process.exit(1)
}

const client = postgres(process.env.DATABASE_URL)
export const db = drizzle(client, {schema})
