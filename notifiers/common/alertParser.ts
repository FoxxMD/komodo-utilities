import { Types } from "npm:komodo_client";
import { formatNumber } from "../../common/utils.ts";

export interface CommonAlert {
    title: string;
    subtitle: string | undefined;
    message: string | undefined;
}

export interface RichAlert extends CommonAlert {
}

export interface ParsingOptions {
    levelInTitle?: boolean;
    markdown?: boolean
}

type Alert = CommonAlert | RichAlert;

type FormatFunc = (str: string) => string;
type Formatting = {
    bold: FormatFunc,
    italic: FormatFunc
    codeInline: FormatFunc
    codeBlock: FormatFunc
}
const noFormatting: FormatFunc = (str: string) => str;

const formatting = (enabled: boolean): Formatting => {
    if(!enabled) {
        return {
            bold: noFormatting,
            italic: noFormatting,
            codeInline: noFormatting,
            codeBlock: noFormatting
        }
    }
    return {
        bold: (str: string) => `**${str}**`,
        italic: (str: string) => `_${str}**`,
        codeInline: (str: string) => `\`${str}\``,
        codeBlock: (str: string) => `\`\`\`
${str}
\`\`\`` 
    }
}

export const parseAlert = <T extends Alert = CommonAlert>(
    alert: Types.Alert,
    options: ParsingOptions = {},
): T => {
    const {
        levelInTitle = true,
        markdown = false,
    } = options;

    const {
        data: {
            type,
            data,
        } = {},
    } = alert;

    const formatter = formatting(markdown);

    const message: string[] = [];
    const title: string[] = [];
    const subtitle: string[] = [];

    let titleStr: string = "";
    let messageStr: string = "";
    let subtitleStr: string = "";

    try {
        if (levelInTitle) {
            title.push(`[${alert.level}]`);
        }
        title.push(`${type}`);

        if (data !== undefined) {
            if ("name" in data) {
                subtitle.push(`for ${formatter.bold(data.name)}`);
            }
            if ("server_name" in data) {
                subtitle.push(`on ${formatter.bold(data.server_name)}`);
            }

            switch (type) {
                case "ServerCpu":
                    message.push(
                        `Hit ${formatter.bold(`${formatNumber(data.percentage, { max: 0 })}%`)}`,
                    );
                    break;
                case "ServerMem":
                    message.push(
                        `Used ${formatter.bold(`${formatNumber(data.used_gb)}/${
                            formatNumber(data.total_gb)
                        }GB`)}`,
                    );
                    break;
                case "ServerDisk":
                    message.push(
                        `Disk at ${formatter.bold(data.path)} used ${formatter.bold(`${
                            formatNumber(data.used_gb)
                        }/${formatNumber(data.total_gb)}GB`)}`,
                    );
                    break;
                case "StackImageUpdateAvailable":
                    message.push(
                        `Service ${formatter.bold(data.service)} | Image ${formatter.bold(data.image)}`,
                    );
                    break;
                case "DeploymentImageUpdateAvailable":
                    message.push(`Image ${formatter.bold(data.image)}`);
                    break;
                case "AwsBuilderTerminationFailed":
                    message.push(
                        `Instance ${formatter.bold(data.instance_id)} | Reason: ${formatter.bold(data.message)}`,
                    );
                    break;
                case "None":
                    break;
                default:
                    if ("err" in data && data.err !== undefined) {
                        message.push(`Err: ${formatter.codeBlock(data.err.error)}`);
                    }
                    if ("from" in data) {
                        message.push(`From ${formatter.bold(data.from)}`);
                    }
                    if ("to" in data) {
                        message.push(`To ${formatter.bold(data.to)}`);
                    }
                    if ("version" in data) {
                        message.push(
                            `Version ${formatter.bold(`${data.version.major}.${data.version.minor}.${data.version.patch}`)}`,
                        );
                    }
                    break;
            }
        }

        return {
            title: title.join(" "),
            subtitle: subtitle.length > 0 ? subtitle.join(" ") : undefined,
            message: message.length > 0 ? message.join(" ") : undefined,
        } as T;
    } catch (e) {
        throw new Error("Error occurred while trying to parse Alert data", {
            cause: e,
        });
    } finally {
        titleStr = title.join(" ");
        subtitleStr = subtitle.length > 0 ? subtitle.join(" ") : "(None)";
        messageStr = message.length > 0 ? message.join(" ") : "(None)";
        console.log(
            `== Alert Summary ==
Title    : ${titleStr}
Subtitle : ${subtitleStr}
Message  : ${messageStr}`,
        );
    }
};
