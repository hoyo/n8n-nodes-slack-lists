import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { simplifyItem } from '../../shared/cells';
import { listRLC } from '../../shared/descriptions';
import type { ListInfo } from '../../shared/schema';
import { getListInfo } from '../../shared/schema';
import { slackApiRequestAllItems } from '../../shared/transport';
import { processItems } from '../../shared/utils';

const show = {
	resource: ['item'],
	operation: ['getAll'],
};

export const itemGetAllDescription: INodeProperties[] = [
	{
		...listRLC,
		displayOptions: { show },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				...show,
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: { show },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Archived',
				name: 'archived',
				type: 'boolean',
				default: false,
				description: 'Whether to return archived items instead of active ones',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const infoCache = new Map<string, ListInfo>();

	return await processItems.call(this, items, async function (i) {
		const listId = this.getNodeParameter('list', i, '', { extractValue: true }) as string;
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const options = this.getNodeParameter('options', i, {}) as IDataObject;

		const body: IDataObject = { list_id: listId };
		if (options.archived) {
			body.archived = true;
		}

		const maxResults = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
		const records = await slackApiRequestAllItems.call(
			this,
			'items',
			'POST',
			'/slackLists.items.list',
			body,
			{},
			maxResults,
		);

		const simplify = this.getNodeParameter('simplify', i, true) as boolean;
		if (!simplify) return records;

		const { schema } = await getListInfo.call(this, listId, infoCache);
		return records.map((record) => simplifyItem(record, schema));
	});
}
