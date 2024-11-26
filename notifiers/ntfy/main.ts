import { Types } from "npm:komodo_client";
import { Config, publish } from "npm:ntfy@1.7.0";
import { CommonAlert, parseAlert } from "../common/alertParser.ts";
import { titleAndSubtitle } from "../common/notifierBuilder.ts";


const NTFY_URL: string = Deno.env.get("NTFY_URL") as string;
if (NTFY_URL === undefined || NTFY_URL.trim() === "") {
    console.error("NTFY_URL not defined in ENV");
    Deno.exit(1);
} else {
    console.info(`nfty URL: ${NTFY_URL}`);
}

const NTFY_TOPIC: string = Deno.env.get("NTFY_TOPIC") as string;
if (NTFY_TOPIC === undefined || NTFY_TOPIC.trim() === "") {
    console.error("NTFY_TOPIC not defined in ENV");
    Deno.exit(1);
} else {
    console.info(`nfty Topic: ${NTFY_TOPIC}`);
}

let NTFY_USER: string | undefined = Deno.env.get("NTFY_USER");
if (NTFY_USER !== undefined && NTFY_USER.trim() === "") {
    NTFY_USER = undefined;
}
let NTFY_PASSWORD: string | undefined = Deno.env.get("NTFY_PASSWORD");
if (NTFY_PASSWORD !== undefined && NTFY_PASSWORD.trim() === "") {
    NTFY_PASSWORD = undefined;
}
let NTFY_TOKEN: string | undefined = Deno.env.get("NTFY_TOKEN");
if (NTFY_TOKEN !== undefined && NTFY_TOKEN.trim() === "") {
    NTFY_TOKEN = undefined;
}

if(NTFY_USER !== undefined && NTFY_PASSWORD !== undefined) {
    console.log('Using User/Password Authentication');
} else if(NTFY_TOKEN !== undefined) {
    console.log('Using Token Authentication');
} else {
    console.log('No Authentication specified');
}

const severityLevelPriority: Record<Types.SeverityLevel, number> = {
    [Types.SeverityLevel.Ok]: 3,
    [Types.SeverityLevel.Warning]: 4,
    [Types.SeverityLevel.Critical]: 5,
};

for (const [level, defaultPriority] of Object.entries(severityLevelPriority)) {
    const envLevel = `NTFY_${level}_PRIORITY`;
    const envLevelVal = Deno.env.get(envLevel);
    if (envLevelVal !== undefined && envLevelVal.trim() !== "") {
        const intVal = parseInt(envLevelVal);
        if (isNaN(intVal)) {
            console.warn(
                `Value of "${envLevelVal}" for ENV ${envLevel} could not be parsed as integer. Using default priority instead`,
            );
        } else {
            severityLevelPriority[level as Types.SeverityLevel] = intVal;
        }
    }
    console.log(
        `Using ntfy priority ${
            severityLevelPriority[level as Types.SeverityLevel]
        } for Komodo severity level "${level}"`,
    );
}

const pushAlert = async (title: string, message: string, priority: number): Promise<any> => {
    try {
        const req: Config = {
            message: message,
            topic: NTFY_TOPIC,
            title: title,
            server: NTFY_URL,
            priority: priority,
        };
        if(NTFY_USER !== undefined && NTFY_PASSWORD !== undefined) {
            req.authorization = {
                username: NTFY_USER,
                password: NTFY_PASSWORD
            }
        } else if(NTFY_TOKEN !== undefined) {
            req.authorization = NTFY_TOKEN;   
        }
        await publish(req);
    } catch (e) {
        throw new Error("Error occurred while trying to push to ntfy", {
            cause: e,
        });
    }
}

Deno.serve({ port: 7000 }, async (req) => {
    const alert: Types.Alert = await req.json();
    console.log(`Recieved data from ${req.headers.get("host")}...`);

    let data: CommonAlert;

    try {
        data = parseAlert(alert);
    } catch (e) {
        console.error(e);
        return new Response();
    }

    pushAlert(titleAndSubtitle(data), data.message ?? '', severityLevelPriority[alert.level]).catch((e) => {
        console.error(
            new Error("Failed to push Alert to ntfy", { cause: e }),
        );
    });

    return new Response();
});