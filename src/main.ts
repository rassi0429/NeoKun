import axios from "axios"
import {Event, NeosEvent} from "./entity/event"
import _, {add} from "lodash"
import express from "express";


/// API
const app = express()
app.use(express.json())
const server = app.listen(3000, () => console.log("API OK"))
app.get("/", async (req, res) => {
    console.log("API Request")
    const result = await getNeosCalender()
    res.json(result)
})


/// Bot
const api = `https://discord.com/api/v8/guilds/${getEnv().guildId}/scheduled-events`
const headers = {
    "Authorization": "Bot " + getEnv().token,
}


async function getNeosCalender(): Promise<NeosEvent[]> {
    const url = getEnv().gcUrl
    try {
        console.log("Google Calender Getting")
        const {data} = await axios.get<NeosEvent[]>(url)
        return data
    } catch {
        console.log("Google Calender Get Error")
        return []
    }
}

setInterval(async () => {
    const newCal = await getNeosCalender()
    await updateDiscordEvent(newCal)
}, 60000)

async function init() {
    if (!(process.env.DISCORD_GUILD_ID && process.env.DISCORD_TOKEN && process.env.GC_URL)) {
        throw new Error("Environment not provided!")
    }
    const data = await getNeosCalender()
    await updateDiscordEvent(data)
}

init()

function getEnv(): Env {
    return {
        gcUrl: process.env.GC_URL || "",
        guildId: process.env.DISCORD_GUILD_ID || "",
        token: process.env.DISCORD_TOKEN || "",
    }
}


async function updateEventDB(events: NeosEvent[]) {
    // TODO
}


async function updateDiscordEvent(googleEvent: NeosEvent[]) {
    const discordEvent = await getDiscordEvent()
    const originalDiscordEvent = _.cloneDeep(discordEvent)
    const addDiff = _.differenceWith(formatEvent(googleEvent), formatEvent(discordEvent), _.isEqual)
    for (const evt of addDiff) {
        await addDiscordEvent(evt.title, new Date(evt.startTime).toISOString(), new Date(evt.endTime).toISOString(), evt.place || "NeosVR",evt.detail)
        console.log("Event Created " + evt.title)
    }
    const delDiff = _.differenceWith(formatEvent(discordEvent), formatEvent(googleEvent), _.isEqual)
    for (const evt of delDiff) {
        const evtId = originalDiscordEvent.find((e) => e.title === evt.title && e.startTime === evt.startTime && e.endTime === evt.endTime)
        if (evtId?.discordEventId) {
            await deleteDiscordEvent(evtId?.discordEventId)
            console.log("Event Deleted " + evtId.title)
        }
    }
}

async function addDiscordEvent(name: string, start: string, end: string, place: string,description: string = "") {
    const body = {
        name: name,
        privacy_level: 2,
        scheduled_start_time: start,
        scheduled_end_time: end,
        entity_type: 3,
        description: description,
        entity_metadata: {
            "location": place
        }
    }
    await axios.post(api, body, {headers})
}

async function getDiscordEvent(): Promise<NeosEvent[]> {
    try {
        console.log("Discord Event Getting")
        const {data} = await axios.get<ScheduledEvent[]>(api, {headers})
        const format: NeosEvent[] = data.map((data) => {
                let t: NeosEvent = {
                    title: data.name,
                    startTime: new Date(data.scheduled_start_time).getTime(),
                    endTime: new Date(data.scheduled_end_time).getTime(),
                    detail: data.description || "",
                    place: data.entity_metadata?.location,
                    discordEventId: data.id
                }
                return t
            }
        )
        return format
    } catch {
        console.log("Discord Event Get Error")
        return []
    }
}

async function deleteDiscordEvent(id: string) {
    const deleteApi = api + "/" + id
    await axios.delete(deleteApi, {headers})
}

function formatEvent(evt: NeosEvent[]) {
    let evtClone = _.cloneDeep(evt)
    let result = []
    for (let e of evtClone) {
        if (e.discordEventId) {
            delete e.discordEventId
        }
        result.push(e)
    }
    return result
}

interface ScheduledEvent {
    id: string
    guild_id: string
    name: string
    description?: string
    scheduled_start_time: string
    scheduled_end_time: string
    entity_type: number
    entity_metadata?: {
        location: string
    }
}

interface Env {
    token: string
    guildId: string
    gcUrl: string
}
