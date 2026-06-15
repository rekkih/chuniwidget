import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlagsBitField,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import type { BotCommand } from '@/types'
import { checkAndRecordLoginAttempt, deleteUser, getUser, setUser } from '@/store'
import { createState } from '@/oauth2/state'
import { buildSnippet } from '@/oauth2/server'
import { LoginFailureError, OtpRequiredError, InvalidOtpError } from '@/sega/errors'

export interface LoginCommandConfig {
    /** Short game name used in the slash command description, e.g. "CHUNITHM" or "maimai DX" */
    gameName: string
    /** Display name of the backing net service, e.g. "CHUNITHM-NET" or "maimai-net" */
    netName: string
    /** Filename sent to the user for the widget installer snippet */
    scriptFilename: string
    /** Performs the actual SEGA login and returns the session token */
    performLogin(segaId: string, password: string, otp?: string): Promise<string>
}

function buildModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('login:modal')
        .setTitle('Link SEGA ID')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('sega_id')
                    .setLabel('SEGA ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('your-sega-id')
                    .setRequired(true)
                    .setMaxLength(64),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('sega_password')
                    .setLabel('Password')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('WILL BE VISIBLE WHEN TYPING!!!')
                    .setRequired(true)
                    .setMaxLength(128),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('sega_otp')
                    .setLabel('2FA code (if enabled)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('6-digit authenticator code')
                    .setRequired(false)
                    .setMinLength(6)
                    .setMaxLength(8),
            ),
        )
}

function buildOAuthUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        response_type: 'code',
        redirect_uri: process.env.OAUTH2_REDIRECT_URI!,
        scope: 'sdk.social_layer+applications.commands',
        integration_type: '1',
        state,
    })
    return `https://discord.com/oauth2/authorize?${params}`
}

export function buildLoginCommand(cfg: LoginCommandConfig): BotCommand {
    const noticeContent = [
        '## Before you continue',
        'You\'re about to enter your SEGA ID and password into a Discord modal.',
        '',
        `**Your password is safe here.** Your password is only stored in temporary memory for the initial login process and destroyed immediately after. After login, we store your unique token that we'll use to read data from ${cfg.netName}.`,
        '',
        `${process.env.BOT_NAME} is **open source** and can be freely inspected to confirm this. **You should ONLY give your SEGA ID to open source bots.** Closed-source bots are known to steal accounts.`,
        '',
        '-# Note: Discord modals show text inputs as plain text while typing. Make sure no one can see your screen.',
        '-# This software is provided as-is with no warranty. By continuing you accept that the developers are not liable for any loss, damage, or account action resulting from misuse of this bot. Directions are there to be followed **exactly** and will not be our fault that you cannot read.',
    ].join('\n')

    return {
        definition: new SlashCommandBuilder()
            .setName('login')
            .setDescription(`Link your SEGA ID to show ${cfg.gameName} stats on your Discord profile`),

        steps: [
            {
                type: 'command',
                async run(interaction) {
                    const existing = await getUser(interaction.user.id)
                    if (existing) {
                        await interaction.reply({
                            flags: MessageFlagsBitField.Flags.Ephemeral,
                            content: 'You\'re already linked! Do you need to reset and login again, or do you just need the widget script?',
                            components: [
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('login:need_script')
                                        .setLabel('Just need the widget script')
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId('login:need_reset')
                                        .setLabel('Reset & login again')
                                        .setStyle(ButtonStyle.Danger),
                                ),
                            ],
                        })
                        return
                    }

                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: noticeContent,
                        components: [
                            new ActionRowBuilder<ButtonBuilder>().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('login:open_modal')
                                    .setLabel('I understand')
                                    .setStyle(ButtonStyle.Primary),
                            ),
                        ],
                    })
                },
            },
            {
                type: 'button',
                id: 'login:need_script',
                async run(interaction) {
                    const snippet = await buildSnippet(process.env.DISCORD_CLIENT_ID!, cfg.scriptFilename)
                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: [
                            'Open **discord.com** in your browser, press `F12` -> **Console**, paste the file below, and hit Enter. If you\'re on a custom Discord client, you can use the devtools in that as well.',
                            '',
                            '**This is a temporary workaround** as Discord doesn\'t list custom app widgets on their UI just yet.',
                            '',
                            '> :warning: **Never paste code into your browser console unless you trust its source.** This snippet is unobfuscated. You can (and should) read through it before running it. It only calls Discord\'s own API to add the widget to your profile.',
                        ].join('\n'),
                        files: [{
                            attachment: Buffer.from(snippet, 'utf8'),
                            name: cfg.scriptFilename,
                        }],
                    })
                },
            },
            {
                type: 'button',
                id: 'login:need_reset',
                async run(interaction) {
                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: [
                            '**To reset your account:**',
                            `1. Go to **Discord Settings -> Connections** and disconnect **${process.env.BOT_NAME}** from the list.`,
                            '2. Click **Confirm** below',
                        ].join('\n'),
                        components: [
                            new ActionRowBuilder<ButtonBuilder>().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('login:confirm_reset')
                                    .setLabel('Confirm')
                                    .setStyle(ButtonStyle.Danger),
                            ),
                        ],
                    })
                },
            },
            {
                type: 'button',
                id: 'login:confirm_reset',
                async run(interaction) {
                    await deleteUser(interaction.user.id)
                    await interaction.reply({
                        flags: MessageFlagsBitField.Flags.Ephemeral,
                        content: noticeContent,
                        components: [
                            new ActionRowBuilder<ButtonBuilder>().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('login:open_modal')
                                    .setLabel('I understand')
                                    .setStyle(ButtonStyle.Primary),
                            ),
                        ],
                    })
                },
            },
            {
                type: 'button',
                id: 'login:open_modal',
                async run(interaction) {
                    await interaction.showModal(buildModal())
                },
            },
            {
                type: 'modal',
                id: 'login:modal',
                async run(interaction) {
                    const segaId = interaction.fields.getTextInputValue('sega_id').trim()
                    const password = interaction.fields.getTextInputValue('sega_password')
                    const otp = interaction.fields.getTextInputValue('sega_otp').trim() || undefined

                    await interaction.deferReply({ ephemeral: true })

                    const rate = await checkAndRecordLoginAttempt(interaction.user.id)
                    if (!rate.allowed) {
                        const retryAt = Math.floor((Date.now() + (rate.retryAfterMs ?? 0)) / 1000)
                        await interaction.editReply(`Too many login attempts. Please try again <t:${retryAt}:R>.`)
                        return
                    }

                    let clal: string
                    try {
                        clal = await cfg.performLogin(segaId, password, otp)
                    } catch (err) {
                        if (err instanceof LoginFailureError) {
                            await interaction.editReply('Invalid SEGA ID or password. Please run `/login` again and check your credentials.')
                            return
                        }
                        if (err instanceof OtpRequiredError) {
                            await interaction.editReply(
                                'Your SEGA account has two-factor authentication enabled.\n' +
                                'Please run `/login` again and enter your authenticator code in the **2FA code** field.',
                            )
                            return
                        }
                        if (err instanceof InvalidOtpError) {
                            await interaction.editReply('Invalid 2FA code. Please run `/login` again with the correct authenticator code.')
                            return
                        }
                        console.error(`[login] ${cfg.netName} login error:`, err)
                        await interaction.editReply('Login failed due to a network error. Please try again in a moment.')
                        return
                    }

                    await setUser(interaction.user.id, segaId, clal)

                    const state = await createState(interaction.user.id)
                    await interaction.editReply({
                        content: [
                            `Got it! ${cfg.netName} login successful. You now need to re-authenticate ${process.env.BOT_NAME} as a **Game Profile** rather than a bot.`,
                            '',
                            'The permissions requested cannot be customised by us - Discord force sets these permissions when linking a game profile (the specific scope is `sdk.social_layer`).',
                            '',
                            `${process.env.BOT_NAME} does not utilise the SDK other than for adding a game widget - we read/use nothing else. This is stated in our [Privacy Policy](<https://yakuon.notion.site/Privacy-Policy-for-Yakuon-ea54dd700ae148759505a506e7a0bfe2>)`,
                        ].join('\n'),
                        components: [
                            new ActionRowBuilder<ButtonBuilder>().addComponents(
                                new ButtonBuilder()
                                    .setLabel('Connect Discord Profile')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(buildOAuthUrl(state)),
                            ),
                        ],
                    })
                },
            },
            {
                type: 'button',
                id: 'login:reauth_open_modal',
                async run(interaction) {
                    await interaction.showModal(
                        new ModalBuilder()
                            .setCustomId('login:reauth_modal')
                            .setTitle('Re-enter SEGA Credentials')
                            .addComponents(
                                new ActionRowBuilder<TextInputBuilder>().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('sega_id')
                                        .setLabel('SEGA ID')
                                        .setStyle(TextInputStyle.Short)
                                        .setPlaceholder('your-sega-id')
                                        .setRequired(true)
                                        .setMaxLength(64),
                                ),
                                new ActionRowBuilder<TextInputBuilder>().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('sega_password')
                                        .setLabel('Password')
                                        .setStyle(TextInputStyle.Short)
                                        .setPlaceholder('WILL BE VISIBLE WHEN TYPING!!!')
                                        .setRequired(true)
                                        .setMaxLength(128),
                                ),
                                new ActionRowBuilder<TextInputBuilder>().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('sega_otp')
                                        .setLabel('2FA code (if enabled)')
                                        .setStyle(TextInputStyle.Short)
                                        .setPlaceholder('6-digit authenticator code')
                                        .setRequired(false)
                                        .setMinLength(6)
                                        .setMaxLength(8),
                                ),
                            )
                    )
                },
            },
            {
                type: 'modal',
                id: 'login:reauth_modal',
                async run(interaction) {
                    const segaId = interaction.fields.getTextInputValue('sega_id').trim()
                    const password = interaction.fields.getTextInputValue('sega_password')
                    const otp = interaction.fields.getTextInputValue('sega_otp').trim() || undefined

                    await interaction.deferReply({ ephemeral: true })

                    const rate = await checkAndRecordLoginAttempt(interaction.user.id)
                    if (!rate.allowed) {
                        const retryAt = Math.floor((Date.now() + (rate.retryAfterMs ?? 0)) / 1000)
                        await interaction.editReply(`Too many login attempts. Please try again <t:${retryAt}:R>.`)
                        return
                    }

                    let clal: string
                    try {
                        clal = await cfg.performLogin(segaId, password, otp)
                    } catch (err) {
                        if (err instanceof LoginFailureError) {
                            await interaction.editReply('Invalid SEGA ID or password. Please try again.')
                            return
                        }
                        if (err instanceof OtpRequiredError) {
                            await interaction.editReply(
                                'Your SEGA account has two-factor authentication enabled.\n' +
                                'Please try again and enter your authenticator code in the **2FA code** field.',
                            )
                            return
                        }
                        if (err instanceof InvalidOtpError) {
                            await interaction.editReply('Invalid 2FA code. Please try again with the correct authenticator code.')
                            return
                        }
                        console.error(`[reauth] ${cfg.netName} login error:`, err)
                        await interaction.editReply('Login failed due to a network error. Please try again in a moment.')
                        return
                    }

                    await setUser(interaction.user.id, segaId, clal)
                    await interaction.editReply('Your session has been refreshed. Your stats will sync shortly.')
                },
            },
        ],
    }
}
