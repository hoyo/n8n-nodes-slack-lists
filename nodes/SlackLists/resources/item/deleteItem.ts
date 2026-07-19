import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { listRLC } from '../../shared/descriptions';
import { slackApiRequest } from '../../shared/transport';
import { processItems } from '../../shared/utils';

const show = {
	resource: ['item'],
	operation: ['delete'],
};

export const itemDeleteDescription: INodeProperties[] = [
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
		description: 'The ID of the item (row) to delete',
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

		await slackApiRequest.call(this, 'POST', '/slackLists.items.delete', {
			list_id: listId,
			id: itemId,
		});

		return { success: true, id: itemId };
	});
}
