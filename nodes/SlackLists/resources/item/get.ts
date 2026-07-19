import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { simplifyItem } from '../../shared/cells';
import { listRLC } from '../../shared/descriptions';
import type { ListColumn } from '../../shared/schema';
import { slackApiRequest } from '../../shared/transport';
import { processItems } from '../../shared/utils';

const show = {
	resource: ['item'],
	operation: ['get'],
};

export const itemGetDescription: INodeProperties[] = [
	{
		...listRLC,
		displayOptions: { show },
	},
	{
		displayName: 'Item ID',
		name: 'itemId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'Rec0123ABCDEF',
		description: 'The ID of the item (row) to retrieve',
		displayOptions: { show },
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: { show },
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return await processItems.call(this, items, async function (i) {
		const listId = this.getNodeParameter('list', i, '', { extractValue: true }) as string;
		const itemId = this.getNodeParameter('itemId', i) as string;

		const response = await slackApiRequest.call(this, 'POST', '/slackLists.items.info', {
			list_id: listId,
			id: itemId,
		});

		const simplify = this.getNodeParameter('simplify', i, true) as boolean;
		if (!simplify) {
			const raw = { ...response };
			delete raw.ok;
			return raw;
		}

		const record = response.record as IDataObject;
		const list = response.list as IDataObject | undefined;
		const metadata = list?.list_metadata as IDataObject | undefined;
		const schema = (metadata?.schema as ListColumn[]) ?? [];
		return simplifyItem(record, schema);
	});
}
