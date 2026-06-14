import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js'
import type { BotCommand } from '@/types'

function buildAddUrl(): string {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        scope: 'applications.commands',
        integration_type: '1',
    })
    return `https://discord.com/oauth2/authorize?${params}`
}

export const linkCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Share an invite link for this bot'),

    steps: [
        {
            type: 'command',
            async run(interaction) {
                const game = (process.env.GAME ?? 'chunithm').toLowerCase()
                const gameName = game === 'maimai' ? 'maimai DX' : 'CHUNITHM'

                await interaction.reply({
                    content: [
                        `## ${process.env.BOT_NAME ?? 'chunibot'}`,
                        `Displays your **${gameName}** stats as a live widget on your Discord profile.`,
                        '',
                        'Click below to add the bot, then run `/login` to get started.',
                    ].join('\n'),
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setLabel('Add to Discord')
                                .setStyle(ButtonStyle.Link)
                                .setURL(buildAddUrl()),
                        ),
                    ],
                })
            },
        },
    ],
}
