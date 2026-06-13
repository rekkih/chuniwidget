import { botApi } from './client'

interface ComponentField {
    value_type: 'data' | 'custom_string' | 'application_asset' | 'application_localized_string'
    presentation_type: 'text' | 'number' | 'image' | 'duration'
    value: string
    fallback?: Omit<ComponentField, 'fallback'>
}

function dataField(key: string, presentation: ComponentField['presentation_type']): ComponentField {
    return { value_type: 'data', presentation_type: presentation, value: key }
}

const SURFACES = {
    mini_profile: {
        layout: 'mini_profile_hero_stat',
        components: {
            hero_image: {
                fields: {
                    image: dataField('primary_image', 'image'),
                },
            },
            stat: {
                fields: {
                    text: dataField('name', 'text'),
                },
            },
        },
    },
    widget_top: {
        layout: 'widget_top_hero',
        components: {
            title: {
                fields: {
                    text: dataField('name', 'text'),
                },
            },
            subtitle_1: {
                fields: {
                    text: dataField('sub01', 'text'),
                },
            },
            hero_image: {
                fields: {
                    image: dataField('primary_image', 'image'),
                },
            },
        },
    },
    add_widget_preview: {
        layout: 'add_widget_preview_hero',
        components: {
            hero_image: {
                fields: {
                    image: dataField('primary_image', 'image'),
                },
            },
        },
    },
    widget_bottom: {
        layout: 'widget_bottom_stats',
        components: {
            stat_1: {
                fields: {
                    value: dataField('f0', 'text'),
                    icon: dataField('f0i', 'image'),
                    label: dataField('f0l', 'text'),
                },
            },
            stat_2: {
                fields: {
                    value: dataField('f1', 'text'),
                    icon: dataField('f1i', 'image'),
                    label: dataField('f1l', 'text'),
                },
            },
            stat_3: {
                fields: {
                    value: dataField('f2', 'text'),
                    icon: dataField('f2i', 'image'),
                    label: dataField('f2l', 'text'),
                },
            },
            stat_4: {
                fields: {
                    value: dataField('f3', 'text'),
                    icon: dataField('f3i', 'image'),
                    label: dataField('f3l', 'text'),
                },
            },
            stat_5: {
                fields: {
                    value: dataField('f4', 'text'),
                    icon: dataField('f4i', 'image'),
                    label: dataField('f4l', 'text'),
                },
            },
            stat_6: {
                fields: {
                    value: dataField('f5', 'text'),
                    icon: dataField('f5i', 'image'),
                    label: dataField('f5l', 'text'),
                },
            },
        },
    },
    activity_accessory: {
        layout: 'activity_accessory_stat',
        components: {
            stat: {
                fields: {
                    text: dataField('activity_text', 'text'),
                    icon: dataField('activity_icon', 'image'),
                },
            },
        },
    },
}

export async function ensureWidgetConfig(displayName: string, replace: boolean): Promise<void> {
    const appId = process.env.DISCORD_CLIENT_ID!

    const existing = await botApi<Array<{ config_id: string }>>(`/applications/${appId}/widget-configs`, 'GET')
    if (existing.length > 0 && !replace) {
        console.log(`[widget] Config already exists (id: ${existing[0].config_id})`)
        return
    }

    if (replace && existing.length > 0) {
        await botApi(`/applications/${appId}/widget-configs/${existing[0].config_id}`, 'DELETE')
        console.log(`[widget] Deleted existing config ${existing[0].config_id}`)
    }

    const config = await botApi<{ config_id: string }>(`/applications/${appId}/widget-configs`, 'POST', {
        display_name: displayName,
        surfaces: SURFACES,
    })

    console.log(`[widget] Created config ${config.config_id}`)

    await botApi(`/applications/${appId}/widget-configs/${config.config_id}/publish`, 'POST')
    console.log('[widget] Published')
}
