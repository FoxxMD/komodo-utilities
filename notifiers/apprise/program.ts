import { Types } from "npm:komodo_client";
import { CommonAlert, parseAlert } from "../common/alertParser.ts";
import { alertResolvedAllowed, parseOptions } from "../common/options.ts";
import { URLData } from "../common/atomic.ts";
import { nonEmptyStringOrDefault, normalizeWebAddress, parseArrayFromMaybeString, truncateStringToLength } from "../common/stringUtils.ts";
import { isPortReachable, joinedUrl } from "../common/networkUtils.ts";
import { titleAndSubtitle } from "../common/notifierBuilder.ts";
import { valToBoolean } from "../../common/utils.ts";
import { setTimeout } from "node:timers";
import { createNotifierPipe } from "../common/notifierUtils.ts";


interface AppriseOptions {
    endpoint: URLData
    urls: string[]
    keys: string[]
    tag?: string
    markdown?: boolean
}

const upstreamFailureHint = 'HINT: Status 424 means a dependency upstream of Apprise failed. This is usually a connection or authentication issue. Check Apprise logs to see more details.';

const shortKey = truncateStringToLength(10);

const parseAppriseOptions = async (): Promise<AppriseOptions> => {

    const markdown = valToBoolean(Deno.env.get("MARKDOWN"));

    const host = nonEmptyStringOrDefault(Deno.env.get("APPRISE_HOST") as string);

    if(host === undefined) {
        throw new Error(`'APPRISE_HOST' must be defined`);
    }

    const urls: string[] = parseArrayFromMaybeString(nonEmptyStringOrDefault(Deno.env.get("APPRISE_STATELESS_URLS"), ''));
    const keys: string[] = parseArrayFromMaybeString(nonEmptyStringOrDefault(Deno.env.get("APPRISE_PERSISTENT_KEYS"), ''));

    if(urls.length === 0 && keys.length === 0) {
        console.warn(`No 'APPRISE_STATELESS_URLS' or 'APPRISE_PERSISTENT_KEYS' were defined! Will assume stateless (POST ${host}/notify) and that you have the ENV 'APPRISE_STATELESS_URLS' set on your Apprise instance`);
    }

    const tag: string | undefined = nonEmptyStringOrDefault(Deno.env.get("APPRISE_TAG"));

     // check url is correct as a courtesy
     const endpoint = normalizeWebAddress(host);
     console.debug(`Apprise Host Config URL: '${host}' => Normalized: '${endpoint.normal}'`)

     try {
         await isPortReachable(endpoint.port, { host: endpoint.url.hostname });
     } catch (e) {
         console.warn(new Error('Unable to detect if server is reachable', { cause: e }));
         return {endpoint, urls, keys, tag};
     }

     if (keys.length > 0) {
         let anyOk = false;
         for (const key of keys) {
             try {
                 const resp = await fetch(joinedUrl(endpoint.url, `/json/urls/${key}`).toString());
                 if (resp.status === 204) {
                     console.warn(`Details for Config ${shortKey(key)} returned no content. Double check the key is set correctly or that the apprise Config is not empty.`);
                 } else {
                     anyOk = true;
                 }
             } catch (e) {
                 console.warn(new Error(`Failed to get details for Config ${shortKey(key)}`, {cause: e}));
             }
         }
         if (!anyOk) {
             console.warn('No Apprise Configs were valid!');
         }
     }

     return {endpoint, urls, keys, tag, markdown};
}

const callApi = async (req: Request): Promise<Response> => {
    let resp: Response | undefined;
    try {
        const resp = await fetch(req);
        if(!resp.ok) {
            let text: string;
            try {
                text = await resp.text();
            } catch (e) {
                console.debug(new Error('Could not parse body from response', {cause: e}));
                throw new Error(`Apprise response NOT OK! Status ${resp.status}`);
            }
            let json: object;
            try {
                json = JSON.parse(text);
            } catch (e) {
                throw new Error(`Apprise response NOT OK! Status ${resp.status} | API Response Body => ${text}`);
            }

            if('error' in json) {
                throw new Error(`Apprise response NOT OK! Status ${resp.status} | API Response Error => ${json.error}`);
            } else {
                throw new Error(`Apprise response NOT OK! Status ${resp.status} | API Response Body => ${text}`);
            }
        }
        return resp;
    } catch (e) {
        if(resp !== undefined) {
            console.debug(resp);
        }
        throw e;
    }
}

const program = async () => {

    let appriseOptions: AppriseOptions;
    const commonOpts = parseOptions();

    try {
        appriseOptions = await parseAppriseOptions();
    } catch (e) {
        throw new Error('Could not parse Apprise options', {cause: e});
    }

    const {keys, urls, endpoint, tag} = appriseOptions;

    let configSummary: string[] = [`Using Apprise @ ${endpoint.normal}`];
    if(urls.length === 0 && keys.length === 0) {
        configSummary.push(`Pushing to stateless endpoint (to '/notify')`)
    } else {
        if(urls.length > 0) {
            configSummary.push(`Pushing to stateless URLs '${urls.join(',')}'`);
        }
        if(keys.length > 0) {
            configSummary.push(`Pushing to persistent keys '${keys.join(',')}'`);
        }
    }
    if(tag !== undefined) {
        configSummary.push(`With tag '${tag}'`);
    }
    console.debug(configSummary.join('\n'));

    const pushAlert = async (
        data: CommonAlert,
        level: Types.SeverityLevel,
    ): Promise<any> => {
        let notifyType: string;
        switch (level) {
            case Types.SeverityLevel.Ok:
                notifyType ='info';
                break;
            case Types.SeverityLevel.Warning:
                notifyType = 'warning';
                break;
            case Types.SeverityLevel.Critical:
                notifyType = 'failure';
                break;
        }

        // Apprise rejects a notification without a body (400 "Payload lacks
        // minimum requirements"). Some alerts have no message, e.g. ResourceSyncPendingUpdates
        // with level OK, so send the title as the body in that case.
        const title = titleAndSubtitle(data);
        const hasMessage = data.message !== undefined && data.message.trim() !== '';
        const body: Record<string, any> = hasMessage
            ? { title, body: data.message, type: notifyType }
            : { body: title, type: notifyType };
        if(tag !== undefined) {
            body.tag = tag;
        }

        const requestOpts: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept':  'application/json'
            }
        }

        if(keys.length > 0) {
            for(const k of keys) {
                try {
                    const resp = await callApi(new Request(joinedUrl(endpoint.url, `/notify/${k}`).toString(), {
                        ...requestOpts,
                        body: JSON.stringify(body)
                    }));
                    await resp.body?.cancel();
                    // @ts-expect-error
                } catch (e: Error) {
                    console.error(new Error(`Failed to send notification with key ${k}${e.message.includes('Status 424') ? ` | ${upstreamFailureHint}` : ''}`, {cause: e}));
                }
            }
        }

        if(urls.length > 0 || keys.length === 0) {
            const urlBody = {...body};
            if(urls.length > 0) {
                urlBody.urls = urls.join(',');
            }
            try {
                const resp = await callApi(new Request(joinedUrl(endpoint.url, `/notify`).toString(), {
                    ...requestOpts,
                    body: JSON.stringify(urlBody)
                }));
                await resp.body?.cancel();
                // @ts-expect-error
            } catch (e: Error) {
                console.error(new Error(`Failed to send notification using URLs${e.message.includes('Status 424') ? ` | ${upstreamFailureHint}` : ''}`, {cause: e}));
            }
        }
    };

    const doAlert = async (data: CommonAlert, alert: Types.Alert) => {
        try {
            await pushAlert(data, alert.level);
        } catch (e) {
            console.debug("Komodo Alert Payload:", alert);
            console.error(
                new Error("Failed to push Alert to Apprise", { cause: e }),
            );
        }
    }

    const notifierPipe = createNotifierPipe(commonOpts);

    const server = Deno.serve({ port: 7000 }, async (req) => {
        const alert: Types.Alert = await req.json();
        console.log(`Recieved data from ${req.headers.get("host")}...`);

        let data: CommonAlert;

        try {
            data = parseAlert(alert, { ...commonOpts, markdown: appriseOptions.markdown });
        } catch (e) {
            console.debug("Komodo Alert Payload:", alert);
            console.error(e);
            return new Response();
        }

        await notifierPipe(alert, () => doAlert(data, alert))

        return new Response();
    });

    return server;
};

export { program };
