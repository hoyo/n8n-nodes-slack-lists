import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { listRLC } from '../../shared/descriptions';
import { slackApiRequest } from '../../shared/transport';
import { processItems, splitIds } from '../../shared/utils';

const show = {
	resource: ['item'],
	operation: ['deleteMany'],
};

export const itemDeleteManyDescription: INodeProperties[] = [
	{
		...listRLC,
		displayOptions: { show },
	},
	{
		displayName: 'Item IDs',
		name: 'itemIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'Rec0123ABCDEF, Rec0456GHIJKL',
		description: 'Comma-separated IDs of the items (rows) to delete',
		displayOptions: { show },
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return await processItems.call(this, items, async function (i) {
		const listId = this.getNodeParameter('list', i, '', { extractValue: true }) as string;
		const itemIds = splitIds(this.getNodeParameter('itemIds', i) as string);

		await slackApiRequest.call(this, 'POST', '/slackLists.items.deleteMultiple', {
			list_id: listId,
			ids: itemIds,
		});

		return { success: true, item_ids: itemIds };
	});
}
