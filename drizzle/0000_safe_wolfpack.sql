CREATE TABLE "users"
(
    "discord_id"    text PRIMARY KEY                       NOT NULL,
    "sega_id"       text                                   NOT NULL,
    "external_id"   text,
    "chuni_token"   text                                   NOT NULL,
    "discord_token" text,
    "linked_at"     timestamp with time zone DEFAULT now() NOT NULL
);
