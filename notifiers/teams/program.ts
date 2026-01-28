import { Types } from "npm:komodo_client";
import { CommonAlert, parseAlert } from "../common/alertParser.ts";
import { parseOptions } from "../common/options.ts";
import { createNotifierPipe } from "../common/notifierUtils.ts";

interface TeamsAdaptiveCard {
    type: string;
    body: Array<{
        type: string;
        text?: string;
        items?: Array<{
            type: string;
            text?: string;
            weight?: string;
            size?: string;
            color?: string;
        }>;
        wrap?: boolean;
    }>;
    $schema?: string;
    version?: string;
}

const program = () => {
    const TEAMS_WEBHOOK: string = Deno.env.get("TEAMS_WEBHOOK") as string;
    if (TEAMS_WEBHOOK === undefined || TEAMS_WEBHOOK.trim() === "") {
        console.error("TEAMS_WEBHOOK not defined in ENV");
        Deno.exit(1);
    }

    const maskedWebhook = TEAMS_WEBHOOK.substring(0, 15) + "..." + TEAMS_WEBHOOK.substring(TEAMS_WEBHOOK.length - 5);
    console.log(`Teams Webhook: ${maskedWebhook} (Length: ${TEAMS_WEBHOOK.length})`);

    const commonOpts = parseOptions();

    const getColorForLevel = (level: Types.SeverityLevel): string => {
        switch (level) {
            case Types.SeverityLevel.Ok:
                return "#58b9ff";
            case Types.SeverityLevel.Warning:
                return "#fa8020";
            case Types.SeverityLevel.Critical:
                return "#fa2020";
            default:
                return "#0078d4";
        }
    };

    const createAdaptiveCard = (
        data: CommonAlert,
        level: Types.SeverityLevel,
        resolved: boolean,
    ): TeamsAdaptiveCard => {
        const color = getColorForLevel(level);
        const resolvedEmoji = resolved ? "✅" : "";

        const card: TeamsAdaptiveCard = {
            type: "AdaptiveCard",
            body: [
                {
                    type: "TextBlock",
                    text: `${resolvedEmoji} ${data.title}`,
                    weight: "bolder",
                    size: "large",
                    color: "default"
                }
            ],
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: "1.4"
        };

        if (data.subtitle !== undefined) {
            card.body.push({
                type: "TextBlock",
                text: data.subtitle,
                wrap: true
            });
        }

        if (data.message !== undefined) {
            card.body.push({
                type: "TextBlock",
                text: data.message,
                wrap: true
            });
        }

        return card;
    };

    const pushAlert = async (
        data: CommonAlert,
        level: Types.SeverityLevel,
        resolved: boolean,
    ): Promise<any> => {
        const card = createAdaptiveCard(data, level, resolved);

        // Microsoft Teams Incoming Webhook requires Adaptive Cards to be wrapped
        // in a "message" type with an "attachments" array.
        const payload = {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null,
                    content: card
                }
            ]
        };

        try {
            const response = await fetch(TEAMS_WEBHOOK, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const responseText = await response.text();
                throw new Error(`Teams webhook failed with status ${response.status}: ${responseText}`);
            }

            console.log(`Successfully sent alert to Teams. Status: ${response.status} ${response.statusText}`);
            return response;
        } catch (e) {
            throw new Error("Failed to send Teams Webhook", { cause: e });
        }
    };

    const doAlert = async (data: CommonAlert, alert: Types.Alert) => {
        try {
            await pushAlert(data, alert.level, alert.resolved);
        } catch (e) {
            console.debug("Komodo Alert Payload:", alert);
            console.error(
                new Error("Failed to push Alert to Teams", { cause: e }),
            );
        }
    };

    const notifierPipe = createNotifierPipe(commonOpts);

    const server = Deno.serve({ port: 7000 }, async (req) => {
        const alert: Types.Alert = await req.json();
        console.log(`Recieved data from ${req.headers.get("host")}...`);

        let data: CommonAlert;

        try {
            data = parseAlert(alert, { ...commonOpts, markdown: false });
        } catch (e) {
            console.debug("Komodo Alert Payload:", alert);
            console.error(e);
            return new Response();
        }

        await notifierPipe(alert, () => doAlert(data, alert));

        return new Response();
    });

    return server;
};

export { program };
