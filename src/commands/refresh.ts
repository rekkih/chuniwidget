import {MessageFlagsBitField, SlashCommandBuilder} from 'discord.js'
import type {BotCommand} from '@/types'
import {getUser} from '@/store'
import {computeSyncInterval} from '@/utils'

export const refreshCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Check when your CHUNITHM profile will next be automatically refreshed'),

    steps: [
        {
            type: 'command',
            async run(interaction) {
                await interaction.deferReply({flags: MessageFlagsBitField.Flags.Ephemeral})

                const user = await getUser(interaction.user.id)

                if (!user) {
                    await interaction.editReply('You have not linked your SEGA ID yet. Run `/login` first.')
                    return
                }

                if (!user.externalId) {
                    await interaction.editReply('Your account is not fully linked yet. Please complete the Discord OAuth step from `/login`.')
                    return
                }

                if (!user.lastSyncedAt) {
                    await interaction.editReply('Your profile has not been synced yet. It will be updated shortly.')
                    return
                }

                const interval = computeSyncInterval(user.lastPlayedAt ?? null)
                const nextSyncAt = new Date(user.lastSyncedAt.getTime() + interval)

                if (nextSyncAt <= new Date()) {
                    await interaction.editReply('Your profile is due for a refresh and will be updated shortly.')
                    return
                }

                const ts = Math.floor(nextSyncAt.getTime() / 1000)
                await interaction.editReply(`Your profile will be refreshed <t:${ts}:R>.`)
            },
        },
    ],
}
