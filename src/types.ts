import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    SlashCommandBuilder,
} from 'discord.js'

export type CommandStep = {
    type: 'command'
    run(interaction: ChatInputCommandInteraction): Promise<void>
}

export type ButtonStep = {
    type: 'button'
    id: string
    run(interaction: ButtonInteraction): Promise<void>
}

export type ModalStep = {
    type: 'modal'
    id: string
    run(interaction: ModalSubmitInteraction): Promise<void>
}

export type Step = CommandStep | ButtonStep | ModalStep

export type BotCommand = {
    definition: SlashCommandBuilder
    steps: Step[]
}
