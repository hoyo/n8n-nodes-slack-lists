# n8n-nodes-slack-lists

![n8n](https://img.shields.io/badge/n8n-community%20node-FF6D5A)
[![npm version](https://img.shields.io/npm/v/n8n-nodes-slack-lists.svg)](https://www.npmjs.com/package/n8n-nodes-slack-lists)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

This is an n8n community node. It lets you use [Slack Lists](https://slack.com/features/lists) in your n8n workflows — create Lists, and create, read, update and delete their items (rows) via the [`slackLists.*` Web API](https://docs.slack.dev/reference/methods?family=lists).

The built-in Slack node does not support Slack Lists; this node fills that gap. It reuses n8n's built-in Slack credential, so if you already have one configured you can use it as-is.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

> [!NOTE]
> Slack Lists are only available on **paid Slack plans**.

- [n8n-nodes-slack-lists](#n8n-nodes-slack-lists)
  - [Installation](#installation)
    - [Community Nodes (recommended)](#community-nodes-recommended)
    - [Manual installation (Docker / self-hosted)](#manual-installation-docker--self-hosted)
  - [Operations](#operations)
    - [Item](#item)
    - [List](#list)
    - [Highlights](#highlights)
  - [Credentials](#credentials)
    - [1. Prepare the Slack app (Slack side)](#1-prepare-the-slack-app-slack-side)
    - [2. Configure the credential (n8n side)](#2-configure-the-credential-n8n-side)
  - [Usage](#usage)
  - [Using as an AI Agent tool](#using-as-an-ai-agent-tool)
  - [Compatibility](#compatibility)
  - [Troubleshooting](#troubleshooting)
  - [Known limitations](#known-limitations)
  - [Development](#development)
  - [Resources](#resources)
  - [License](#license)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `n8n-nodes-slack-lists` as the npm package name
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes and select **Install**

### Manual installation (Docker / self-hosted)

```bash
# Inside your n8n data directory (e.g. ~/.n8n or /home/node/.n8n in Docker)
mkdir -p nodes && cd nodes
npm install n8n-nodes-slack-lists
# Restart your n8n instance
```

## Operations

### Item

| Operation | Description | API method |
| --- | --- | --- |
| Create | Add an item (row) with column mapping | `slackLists.items.create` |
| Delete | Delete an item | `slackLists.items.delete` |
| Delete Many | Delete multiple items at once | `slackLists.items.deleteMultiple` |
| Get | Retrieve a single item | `slackLists.items.info` |
| Get Many | Retrieve items with pagination and archived filter | `slackLists.items.list` |
| Update | Update cells of an item | `slackLists.items.update` |

### List

| Operation | Description | API method |
| --- | --- | --- |
| Create | Create a List (todo mode, column schema, copy from existing) | `slackLists.create` |
| Get | Retrieve a List's metadata and column schema | `files.info` |
| Grant Access | Grant users or channels read/write/owner access | `slackLists.access.set` |
| Revoke Access | Revoke access from users or channels | `slackLists.access.delete` |

### Highlights

- **List picker** — search the Lists visible to your token, or paste a List URL / ID.
- **Dynamic column mapping** — Item Create/Update load the List's actual columns (text, select, user, date, checkbox, rating, …) into n8n's column mapping UI. Select columns become dropdowns with their real choices, and plain text is converted to Slack's `rich_text` format automatically.
- **Simplified output** — items are returned as `{ id, ..., fields: { "Column Name": value } }` instead of the raw cell format. Toggle off via the **Simplify** parameter to get raw API responses.

## Credentials

This node uses n8n's **built-in Slack credential (`Slack API`, access token)** — no separate credential type. If you already have a Slack credential in n8n, add the scopes below to its Slack app and you are done.

### 1. Prepare the Slack app (Slack side)

1. Open your app at [api.slack.com/apps](https://api.slack.com/apps) (or create one)
2. Go to **OAuth & Permissions > Scopes** and add the following (bot or user scopes, matching the token you use):

   | Scope | Used for |
   | --- | --- |
   | `lists:read` | Reading items |
   | `lists:write` | Creating/updating/deleting items and Lists, managing access |
   | `files:read` | List picker, column mapping and List Get (Lists are files in Slack) |

3. **Reinstall the app** to your workspace so the new scopes take effect
4. Copy the **Bot User OAuth Token** (`xoxb-…`) or **User OAuth Token** (`xoxp-…`)

### 2. Configure the credential (n8n side)

1. In n8n, go to **Credentials > Add credential** and search for **Slack API**
2. Paste the token into **Access Token** and save

> [!CAUTION]
> Keep the token secret. Anyone with the token can access your Slack workspace within its scopes.

## Usage

Typical flow — append a row to a List from any data source:

1. **Slack Lists** node → Resource: `Item`, Operation: `Create`
2. Pick the List (search by name, or paste its URL)
3. Map columns in **Values to Send** — or switch the mapping mode to *Map Automatically* to fill columns whose names match the input JSON keys

With **Simplify** enabled (default), items come out ready to use:

```json
{
  "id": "Rec0123ABCDEF",
  "list_id": "F0123ABCDEF",
  "date_created": 1784460441,
  "fields": {
    "Title": "Invoice issued",
    "Status": "in_review",
    "Assignee": "U0123ABCD"
  }
}
```

Notes on column values:

- **Select** columns accept and return the option *value* (e.g. `day_1`, `OptXXXXXX`), which you can pick from the dropdown in the mapping UI
- **User / Channel** columns accept IDs (`U…` / `C…`); multi-value columns accept comma-separated IDs or arrays
- **Date** columns accept anything `new Date()` can parse and are sent as `YYYY-MM-DD`

## Using as an AI Agent tool

This node is marked as usable by AI Agents (`usableAsTool`). To allow community nodes as tools, set this environment variable on your n8n instance:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

The Get a List operation is handy for agents: it returns the List's column schema, letting the agent discover valid columns and select options before writing rows.

## Compatibility

- **Tested against**: n8n 2.27 (self-hosted, Docker)
- Requires an n8n version with the resource mapper UI (n8n 1.x or later); older versions are untested

## Troubleshooting

| Error / Symptom | Cause | Solution |
| --- | --- | --- |
| `missing_scope` | The token lacks a required OAuth scope (the message names the missing one) | Add `lists:read` / `lists:write` / `files:read` in the Slack app and **reinstall** it |
| `paid_teams_only` | Slack Lists are not available on free plans | Upgrade the workspace to a paid plan |
| `list_not_found` / `access_denied` | The token cannot see the List | Share the List (or its channel) with the app's bot user, or use a user token with access |
| List picker shows nothing | `files:read` missing, or no Lists are visible to the token | Add the scope; paste the List URL / ID directly as an alternative |
| "Custom API Call" appears in dropdowns | Injected automatically by n8n for all nodes with authenticated credentials — not implemented by this node | Use the HTTP Request node with your Slack credential for uncovered API methods |

## Known limitations

- The Slack API provides no method to delete a List, and `slackLists.update` can only change name/description/todo-mode (columns cannot be modified after creation), so these are not exposed.
- List export (`slackLists.download.*`) is out of scope.
- This package references the built-in `slackApi` credential type and therefore does not target n8n Cloud's verified community node program. Self-hosted instances are unaffected.

## Development

```bash
git clone https://github.com/hoyo/n8n-nodes-slack-lists.git
cd n8n-nodes-slack-lists
npm install
npm run build   # compile to dist/
npm test        # unit tests (vitest)
npm run lint
npm run dev     # run a local n8n with the node linked
```

## Resources

- [Slack Lists API reference](https://docs.slack.dev/reference/methods?family=lists)
- [Slack Lists product page](https://slack.com/features/lists)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
