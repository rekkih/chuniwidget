import {
    ActionRowBuilder,
    MessageFlagsBitField,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from 'discord.js'
import type { BotCommand } from '@/types'
import { getUser, setConvertWidth, setDescriptionMode } from '@/store'
import { DESCRIPTION_MODES, isDescriptionMode, type DescriptionMode } from '@/discord/maimai/descriptionModes'

const DESCRIPTION_ID = 'config:description'
const WIDTH_ID = 'config:width'

function descriptionMenu(current: DescriptionMode): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(DESCRIPTION_ID)
        .setPlaceholder('What should your profile show?')
        .addOptions(
            (Object.entries(DESCRIPTION_MODES) as [DescriptionMode, (typeof DESCRIPTION_MODES)[DescriptionMode]][])
                .map(([value, { label, description }]) => ({
                    value,
                    label,
                    description,
                    default: value === current,
                })),
        )
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
}

function widthMenu(current: boolean): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(WIDTH_ID)
        .setPlaceholder('Convert full-width characters?')
        .addOptions(
            { value: 'on', label: 'Convert full-width', description: 'Fold ＦＵＬＬＷＩＤＴＨ text to normal width', default: current },
            { value: 'off', label: 'Keep as-is', description: 'Show names and titles exactly as set in-game', default: !current },
        )
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
}

export const configCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Choose what your maimai DX profile widget shows'),

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
                    content: 'Configure your maimai DX profile widget:',
                    components: [descriptionMenu(current), widthMenu(user.convertWidth)],
                })
            },
        },
        {
            type: 'select',
            id: DESCRIPTION_ID,
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
                await interaction.reply({
                    flags: MessageFlagsBitField.Flags.Ephemeral,
                    content: `Done! Your profile will now show **${DESCRIPTION_MODES[choice].label}**. The widget updates within a minute.`,
                })
            },
        },
        {
            type: 'select',
            id: WIDTH_ID,
            async run(interaction) {
                const convert = interaction.values[0] === 'on'
                await setConvertWidth(interaction.user.id, convert)
                await interaction.reply({
                    flags: MessageFlagsBitField.Flags.Ephemeral,
                    content: convert
                        ? 'Done! Full-width characters will be converted to normal width. The widget updates within a minute.'
                        : 'Done! Names and titles will be shown exactly as set in-game. The widget updates within a minute.',
                })
            },
        },
    ],
}
