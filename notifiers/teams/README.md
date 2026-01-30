A [Komodo](https://komo.do/) [Alerter](https://komo.do/docs/resources#alerter)
client for
[Microsoft Teams Incoming Webhooks](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)

# Usage

1. Create an Incoming Webhook in your Microsoft Teams channel
2. Copy the webhook URL
3. Set the `TEAMS_WEBHOOK` environment variable to the webhook URL

# Building

Run from the repository top-level folder:

```shell
docker build -t komodo-teams-alerter -f notifiers/teams/Dockerfile .
```

# Environment Variables

- `TEAMS_WEBHOOK` (required): The Microsoft Teams incoming webhook URL
- `LEVEL_IN_TITLE` (optional): Include alert level in title (default: true)
- `INDICATE_RESOLVED` (optional): Show resolved status with checkmark (default:
  true)
- `ALLOW_RESOLVED_TYPE` (optional): Filter which resolved states to notify on
  (comma-separated: "resolved,unresolved")
- `UNRESOLVED_TIMEOUT` (optional): Time in ms to wait before sending unresolved
  alerts
- `UNRESOLVED_TIMEOUT_TYPES` (optional): Alert types to apply timeout to
  (comma-separated)
