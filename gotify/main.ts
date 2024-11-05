import { Types } from "npm:komodo_client";
import { gotify } from "npm:gotify@1.1.0";

async function handle_alert(alert: Types.Alert) {

    const GOTIFY_API_KEY = Deno.env.get('GOTIFY_API_KEY');
    if(GOTIFY_API_KEY === undefined) {
        console.error('GOTIFY_API_KEY not defined in ENV');
        return;
    }
    const GOTIFY_URL = Deno.env.get('GOTIFY_URL');
    if(GOTIFY_URL === undefined) {
        console.error('GOTIFY_URL not defined in ENV');
        return;
    }

    const {
        data: {
            type,
            data
        } = {},
    } = alert;

    const message: string[] = [];
    const title: string[] = [`[${alert.level}] ${type}`];
    const titleName: string[] = [];
    if(data !== undefined) {
        if('name' in data) {
            titleName.push(`for ${data.name}`);
        }
        if('server_name' in data) {
            titleName.push(`on ${data.server_name}`)
        }
        if(titleName.length > 0) {
            title.push(titleName.join(' '));
        }

        switch(type) {
            case 'ServerCpu':
                message.push(`Hit ${data.percentage}%`);
                break;
            case 'ServerMem':
                message.push(`Used ${data.used_gb}/${data.total_gb}GB`);
                break;
            case 'ServerDisk':
                message.push(`Disk at ${data.path} used ${data.used_gb}/${data.total_gb}GB`);
                break;
            case 'StackImageUpdateAvailable':
                message.push(`Service ${data.service} | Image ${data.image}`);
                break;
            case 'DeploymentImageUpdateAvailable':
                message.push(`Image ${data.image}`);
                break;
            case 'AwsBuilderTerminationFailed':
                message.push(`Instance ${data.instance_id} | Reason: ${data.message}`);
                break;
            case 'None':
                break;
            default:
                if('err' in data && data.err !== undefined) {
                    message.push(`Err: ${data.err.error}`)
                }
                if('from' in data) {
                    message.push(`From ${data.from}`);
                }
                if('to' in data) {
                    message.push(`To ${data.to}`);
                }
                if('version' in data) {
                    message.push(`Version ${data.version.major}.${data.version.minor}.${data.version.patch}`)
                }
                break;
        }
    }

    let priority = 0;
    switch(alert.level) {
        case Types.SeverityLevel.Ok:
            priority = 3;
            break;
        case Types.SeverityLevel.Warning:
            priority = 5;
            break;
        case Types.SeverityLevel.Critical:
            priority = 8;
            break;
    }

    await gotify({
        server: GOTIFY_URL,
        app: GOTIFY_API_KEY,
        title: title.join(' '),
        message: message.length > 0 ? message.join(' ') : '',
        priority,
      });
}

Deno.serve({ port: 7000 }, async (req) => {
  const alert: Types.Alert = await req.json();
  handle_alert(alert);
  // No need to await handling before returning response.
  return new Response();
});