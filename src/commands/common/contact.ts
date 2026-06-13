import {MessageFlagsBitField, SlashCommandBuilder} from 'discord.js'
import type {BotCommand} from '@/types'

export const contactCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('contact')
        .setDescription('Contact support')
        .addStringOption(opt =>
            opt.setName('query')
                .setDescription('What do you need help with?')
                .setRequired(true),
        )
        .addBooleanOption(opt =>
            opt.setName('premium')
                .setDescription('Get higher quality(tm) support(tm)')
                .setRequired(false),
        ),

    steps: [
        {
            type: 'command',
            async run(interaction) {
                const query = interaction.options.getString('query', true)
                const premium = interaction.options.getBoolean('premium') ?? false

                const base = premium ? 'https://kagi.com/search' : 'https://www.google.com/search'
                const url = `${base}?q=${encodeURIComponent(query)}`

                await interaction.reply({
                    flags: MessageFlagsBitField.Flags.Ephemeral,
                    content: `Here's your support ticket: ${url}`,
                })
            },
        },
    ],
}
