import { SlashCommandBuilder } from 'discord.js'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer'
import type { BotCommand } from '@/types'
import { getUser } from '@/store'
import { ChuniClient } from '@/chunithm-net/client'

export const profileGifCommand: BotCommand = {
    definition: new SlashCommandBuilder()
        .setName('profilegif')
        .setDescription('Record your CHUNITHM profile card as a GIF'),

    steps: [
        {
            type: 'command',
            async run(interaction) {
                const user = await getUser(interaction.user.id)
                if (!user) {
                    await interaction.reply({ content: 'You have not linked your SEGA ID yet. Run `/login` first.', ephemeral: true })
                    return
                }

                await interaction.deferReply()

                try {
                    const cookies = await new ChuniClient(user.chuniToken).getCookies()

                    const tmpDir = join(tmpdir(), `chuniprofile_${randomUUID()}`)
                    await mkdir(tmpDir, { recursive: true })

                    try {
                        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
                        try {
                            const page = await browser.newPage()
                            await page.setViewport({ width: 552, height: 900, deviceScaleFactor: 2 })

                            for (const [name, value] of cookies) {
                                await page.setCookie({ name, value, domain: 'chunithm-net-eng.com', path: '/' })
                            }

                            await page.goto('https://chunithm-net-eng.com/mobile/home/playerData', { waitUntil: 'networkidle2' })
                            await page.waitForSelector('.box_playerprofile')

                            const element = await page.$('.box_playerprofile')
                            const clip = await element!.boundingBox()
                            if (!clip) throw new Error('Could not determine profile card bounding box')

                            let count = 0
                            let resolveFirst!: () => void
                            let resolveSecond!: () => void
                            const firstDone  = new Promise<void>(r => (resolveFirst  = r))
                            const secondDone = new Promise<void>(r => (resolveSecond = r))

                            await page.exposeFunction('__marqueeIter', () => {
                                count++
                                if (count === 1) resolveFirst()
                                if (count === 2) resolveSecond()
                            })

                            const hasMarquee = await page.evaluate(() => {
                                const el = document.querySelector('.js-marquee-wrapper')
                                if (!el) return false
                                el.addEventListener('animationiteration', () => (window as any).__marqueeIter())
                                return true
                            })

                            if (!hasMarquee) {
                                resolveFirst()
                                setTimeout(resolveSecond, 3000)
                            }

                            await firstDone

                            let stop = false
                            secondDone.then(() => { stop = true })

                            let frameIndex = 0
                            while (!stop) {
                                const framePath = join(tmpDir, `frame${String(frameIndex).padStart(4, '0')}.png`)
                                await page.screenshot({ clip, path: framePath })
                                frameIndex++
                                await Bun.sleep(Math.floor(1000 / 15))
                            }

                            await secondDone
                        } finally {
                            await browser.close()
                        }

                        const outputPath = join(tmpDir, 'output.gif')
                        const ffmpeg = Bun.spawn([
                            'ffmpeg', '-framerate', '15',
                            '-i', join(tmpDir, 'frame%04d.png'),
                            '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
                            '-loop', '0',
                            outputPath,
                        ], { stdout: 'pipe', stderr: 'pipe' })

                        const exitCode = await ffmpeg.exited
                        if (exitCode !== 0) {
                            const errText = await new Response(ffmpeg.stderr).text()
                            throw new Error(`ffmpeg failed (exit ${exitCode}): ${errText}`)
                        }

                        const gifBuffer = Buffer.from(await Bun.file(outputPath).arrayBuffer())
                        await interaction.editReply({ files: [{ attachment: gifBuffer, name: 'profile.gif' }] })
                    } finally {
                        await rm(tmpDir, { recursive: true, force: true })
                    }
                } catch (err) {
                    console.error('[profilegif] error:', err)
                    await interaction.editReply('Something went wrong while generating your profile GIF. Please try again later.')
                }
            },
        },
    ],
}
