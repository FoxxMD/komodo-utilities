Small utilities to enhance [Komodo](https://komo.do)

# Alerters

## Gotify Alerter

An [Alerter](https://komo.do/docs/resources#alerter) that pushes to [Gotify](https://gotify.net/)

[See README](/notifiers/gotify/README.md)

## ntfy Alerter

An [Alerter](https://komo.do/docs/resources#alerter) that pushes to [ntfy](https://ntfy.sh/)

[See README](/notifiers/ntfy/README.md)

## Discord Webhook Alerter

An [Alerter](https://komo.do/docs/resources#alerter) that pushes to a [Discord Webhook](https://discordjs.guide/popular-topics/webhooks.html#what-is-a-webhook)

[See README](/notifiers/discord/README.md)

## Apprise API Webhook Alerter

An [Alerter](https://komo.do/docs/resources#alerter) that pushes to [Apprise](https://github.com/caronc/apprise) using [Apprise API](https://github.com/caronc/apprise-api)

[See README](/notifiers/apprise/README.md)

## Microsoft Teams Webhook Alerter

An [Alerter](https://komo.do/docs/resources#alerter) that pushes to [Microsoft Teams](https://docs.microsoft.com/en-us/microsoftteams/) using Incoming Webhooks

[See README](/notifiers/teams/README.md)

# [Actions](https://komo.do/docs/procedures)

## Find IP

[Find one or many Containers by IP or Gateway address.](/actions/find_ip.toml)

Accepts a comma-delimited list of strings to find within the address so it works for finding partial IPs or subnets.

Output contains Server, Stack, Container, and Network where it was found:

```
Server my-server -> Container myStack-myContainer-1 has Gateway 172.16.10.1 in Network mynetwork_default, IP 172.16.10.2 in Network mynetwork_default
```