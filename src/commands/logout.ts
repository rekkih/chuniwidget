import {ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlagsBitField, SlashCommandBuilder} from 'discord.js'
import type {BotCommand} from '@/types'
import {deleteUser, getUser} from '@/store'

export const unlinkCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('logout')
        .setDescription('Remove your SEGA ID link and delete all your data from Yakuon'),

    steps: [
        {
            type: 'command',
            async run(interaction) {
                const existing = await getUser(interaction.user.id)
                if (!existing) {
                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: 'You don\'t have a linked account.',
                    })
                    return
                }

                await interaction.reply({
                    flags: MessageFlagsBitField.Flags.Ephemeral,
                    content: [
                        '**Are you sure you want to logout?**',
                        'This will delete all your data from Yakuon. Also go to **Discord Settings -> Connections** and remove **Yakuon** from the list to fully disconnect.',
                    ].join('\n'),
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId('unlink:confirm')
                                .setLabel('Confirm')
                                .setStyle(ButtonStyle.Danger),
                        ),
                    ],
                })
            },
        },
        {
            type: 'button',
            id: 'unlink:confirm',
            async run(interaction) {
                await deleteUser(interaction.user.id)
                await interaction.reply({
                    flags: MessageFlagsBitField.Flags.Ephemeral,
                    content: 'Your data on my servers have been deleted. Goodbye.',
                })
            },
        },
    ],
}
