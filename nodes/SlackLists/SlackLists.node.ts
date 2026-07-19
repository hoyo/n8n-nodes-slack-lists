import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { getLists } from './methods/listSearch';
import { getColumns } from './methods/resourceMapping';
import { itemDescription } from './resources/item';
import { listDescription } from './resources/list';
import { router } from './resources/router';

export class SlackLists implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Slack Lists',
		name: 'slackLists',
		icon: { light: 'file:slacklists.svg', dark: 'file:slacklists.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage Slack Lists and their items via the slackLists.* API',
		defaults: {
			name: 'Slack Lists',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'slackApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Item',
						value: 'item',
					},
					{
						name: 'List',
						value: 'list',
					},
				],
				default: 'item',
			},
			...itemDescription,
			...listDescription,
		],
	};

	methods = {
		listSearch: {
			getLists,
		},
		resourceMapping: {
			getColumns,
		},
	};

	// eslint-disable-next-line @n8n/community-nodes/require-continue-on-fail -- continueOnFail is handled per item in shared/utils.ts processItems
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await router.call(this);
	}
}
