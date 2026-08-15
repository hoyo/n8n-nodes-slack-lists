import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { getLists } from './methods/listSearch';
import { listRLC } from './shared/descriptions';
import { getListInfo } from './shared/schema';
import { toIsoString } from './shared/utils';

/**
 * Builds the trigger's output item from a raw files.info `file` object.
 * `updated` is the effective last-update timestamp used for change detection,
 * i.e. Math.max(file.updated, file.edit_timestamp) in unix seconds.
 */
export function buildListUpdateOutput(file: IDataObject, currentMaxTs: number): IDataObject {
	return {
		list_id: file.id,
		title: file.title,
		updated: toIsoString(currentMaxTs),
		last_editor: file.last_editor,
		permalink: file.permalink,
	};
}

// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool -- trigger nodes cannot be invoked as AI tools, and the property only accepts `true`
export class SlackListsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Slack Lists Trigger',
		name: 'slackListsTrigger',
		icon: { light: 'file:slacklists.svg', dark: 'file:slacklists.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '=Updated: {{$parameter["list"]["value"] || $parameter["list"]}}',
		description: 'Starts the workflow when a Slack List is updated',
		defaults: {
			name: 'Slack Lists Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'slackApi',
				required: true,
			},
		],
		properties: [{ ...listRLC }],
	};

	methods = {
		listSearch: {
			getLists,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const listId = this.getNodeParameter('list', '', { extractValue: true }) as string;

		const { file } = await getListInfo.call(this, listId);
		const currentMaxTs = Math.max(Number(file.updated ?? 0), Number(file.edit_timestamp ?? 0));
		const output = buildListUpdateOutput(file, currentMaxTs);

		// Manual executions (e.g. the "Fetch Test Event" button) should always
		// return the current state without touching the stored watermark.
		if (this.getMode() === 'manual') {
			return [this.helpers.returnJsonArray([output])];
		}

		const staticData = this.getWorkflowStaticData('node');
		const lastMaxTs = staticData.lastMaxTs as number | undefined;

		// First poll after activation: record the baseline and do not fire, so an
		// existing List does not trigger a spurious run on the very first check.
		if (lastMaxTs === undefined) {
			staticData.lastMaxTs = currentMaxTs;
			return null;
		}

		// No new edit since the last poll — do not fire (polling triggers do not
		// keep "no change" runs in the executions list).
		if (currentMaxTs <= lastMaxTs) {
			return null;
		}

		staticData.lastMaxTs = currentMaxTs;
		return [this.helpers.returnJsonArray([output])];
	}
}
