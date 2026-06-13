CREATE TABLE "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
