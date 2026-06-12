import {
    ActionRowBuilder,
    MessageFlagsBitField,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js'
import type {BotCommand} from '../types'
import {getUser, setDescriptionMode} from '../store'
import {DESCRIPTION_MODES, isDescriptionMode, type DescriptionMode} from '../discord/descriptionModes'

const SELECT_ID = 'config:description'

function buildMenu(current: DescriptionMode): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(SELECT_ID)
        .setPlaceholder('What should your profile show?')
        .addOptions(
            (Object.entries(DESCRIPTION_MODES) as [DescriptionMode, (typeof DESCRIPTION_MODES)[DescriptionMode]][])
                .map(([value, {label, description}]) => ({
                    value,
                    label,
                    description,
                    default: value === current,
                })),
        )
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
}

export const configCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Choose what your CHUNITHM profile widget shows'),

    steps: [
        {
            type: 'command',
            async run(interaction) {
                const user = await getUser(interaction.user.id)
                if (!user) {
                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: 'You have not linked your SEGA ID yet. Run `/login` first.',
                    })
                    return
                }

                const current = isDescriptionMode(user.descriptionMode) ? user.descriptionMode : 'title'
                await interaction.reply({
                    flags: MessageFlagsBitField.Flags.Ephemeral,
                    content: 'Choose what to display under your name on your Discord profile widget:',
                    components: [buildMenu(current)],
                })
            },
        },
        {
            type: 'select',
            id: SELECT_ID,
            async run(interaction) {
                const choice = interaction.values[0]
                if (!choice || !isDescriptionMode(choice)) {
                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: 'Unknown option.',
                    })
                    return
                }

                await setDescriptionMode(interaction.user.id, choice)
                await interaction.update({
                    content: `Done! Your profile will now show **${DESCRIPTION_MODES[choice].label}**. The widget updates within a minute.`,
                    components: [],
                })
            },
        },
    ],
}
