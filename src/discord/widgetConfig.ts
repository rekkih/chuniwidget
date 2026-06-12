import { botApi } from './client'

interface ComponentField {
    value_type: 'data' | 'custom_string' | 'application_asset' | 'application_localized_string';
    presentation_type: 'text' | 'number' | 'image' | 'duration';
    value: string;
    fallback?: Omit<ComponentField, 'fallback'>;
}

function dataField(key: string, presentation: ComponentField['presentation_type']): ComponentField {
    return { value_type: 'data', presentation_type: presentation, value: key }
}

export async function ensureWidgetConfig(): Promise<void> {
    const appId = process.env.DISCORD_CLIENT_ID!

    const existing = await botApi<Array<{ config_id: string }>>(`/applications/${appId}/widget-configs`, 'GET')
    if (existing.length > 0) {
        console.log(`[widget] Config already exists (id: ${existing[0].config_id})`)
        return
    }

    const surfaces = {
        mini_profile: {
            layout: 'mini_profile_hero_stat',
            components: {
                hero: {
                    fields: {
                        image: dataField('primary_image', 'image'),
                        title: dataField('name', 'text'),
                        subtitle: dataField('sub01', 'text'),
                    },
                },
                primary_stat: {
                    fields: {
                        value: dataField('f0', 'text'),
                        label: dataField('f0l', 'text'),
                    },
                },
                secondary_stat: {
                    fields: {
                        value: dataField('f1', 'text'),
                        label: dataField('f1l', 'text'),
                    },
                },
            },
        },
        widget_top: {
            layout: 'widget_top_contained',
            components: {
                header: {
                    fields: {
                        image: dataField('primary_image', 'image'),
                        title: dataField('name', 'text'),
                        subtitle: dataField('sub01', 'text'),
                    },
                },
                stat_row: {
                    fields: {
                        stat_0_value: dataField('f0', 'text'),
                        stat_0_label: dataField('f0l', 'text'),
                        stat_1_value: dataField('f1', 'text'),
                        stat_1_label: dataField('f1l', 'text'),
                        stat_2_value: dataField('f2', 'text'),
                        stat_2_label: dataField('f2l', 'text'),
                    },
                },
            },
        },
        widget_bottom: {
            layout: 'widget_bottom_stats',
            components: {
                stats: {
                    fields: {
                        stat_0_value: dataField('f3', 'text'),
                        stat_0_label: dataField('f3l', 'text'),
                        stat_0_icon: dataField('f3i', 'image'),
                        stat_1_value: dataField('f4', 'text'),
                        stat_1_label: dataField('f4l', 'text'),
                        stat_1_icon: dataField('f4i', 'image'),
                        stat_2_value: dataField('f5', 'text'),
                        stat_2_label: dataField('f5l', 'text'),
                        stat_2_icon: dataField('f5i', 'image'),
                    },
                },
            },
        },
        activity_accessory: {
            layout: 'activity_accessory_stat',
            components: {
                content: {
                    fields: {
                        icon: dataField('preview_icon', 'image'),
                        text: dataField('activity_text', 'text'),
                        value: dataField('f0', 'text'),
                        label: dataField('f0l', 'text'),
                    },
                },
            },
        },
    }

    const config = await botApi<{ config_id: string }>(`/applications/${appId}/widget-configs`, 'POST', {
        display_name: 'CHUNITHM',
        surfaces,
    })

    console.log(`[widget] Created config ${config.config_id}`)

    await botApi(`/applications/${appId}/widget-configs/${config.config_id}/publish`, 'POST')
    console.log('[widget] Published')
}
