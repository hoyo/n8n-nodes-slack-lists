import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { buildCells, getColumnValues } from '../../shared/cells';
import { listRLC } from '../../shared/descriptions';
import type { ListInfo } from '../../shared/schema';
import { getListInfo } from '../../shared/schema';
import { slackApiRequest } from '../../shared/transport';
import { processItems } from '../../shared/utils';

const show = {
	resource: ['item'],
	operation: ['update'],
};

export const itemUpdateDescription: INodeProperties[] = [
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
		description: 'The ID of the item (row) to update',
		displayOptions: { show },
	},
	{
		displayName: 'Columns',
		name: 'columns',
		type: 'resourceMapper',
		noDataExpression: true,
		default: { mappingMode: 'defineBelow', value: null },
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['list.value'],
			resourceMapper: {
				resourceMapperMethod: 'getColumns',
				mode: 'add',
				fieldWords: { singular: 'column', plural: 'columns' },
				addAllFields: false,
				multiKeyMatch: false,
			},
		},
		displayOptions: { show },
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const infoCache = new Map<string, ListInfo>();

	return await processItems.call(this, items, async function (i) {
		const listId = this.getNodeParameter('list', i, '', { extractValue: true }) as string;
		const itemId = this.getNodeParameter('itemId', i) as string;
		const { schema } = await getListInfo.call(this, listId, infoCache);

		const values = getColumnValues.call(this, i, schema);
		const cells = buildCells
			.call(this, schema, values)
			.map((cell) => ({ row_id: itemId, ...cell }));

		if (!cells.length) {
			throw new NodeOperationError(this.getNode(), 'No column values to update were provided', {
				itemIndex: i,
			});
		}

		await slackApiRequest.call(this, 'POST', '/slackLists.items.update', {
			list_id: listId,
			cells,
		});

		return { success: true, id: itemId };
	});
}
