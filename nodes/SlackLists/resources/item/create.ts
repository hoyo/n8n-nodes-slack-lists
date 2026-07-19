import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { buildCells, getColumnValues, simplifyItem } from '../../shared/cells';
import { listRLC } from '../../shared/descriptions';
import type { ListInfo } from '../../shared/schema';
import { getListInfo } from '../../shared/schema';
import { slackApiRequest } from '../../shared/transport';
import { processItems } from '../../shared/utils';

const show = {
	resource: ['item'],
	operation: ['create'],
};

export const itemCreateDescription: INodeProperties[] = [
	{
		...listRLC,
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
				addAllFields: true,
				multiKeyMatch: false,
			},
		},
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
	const infoCache = new Map<string, ListInfo>();

	return await processItems.call(this, items, async function (i) {
		const listId = this.getNodeParameter('list', i, '', { extractValue: true }) as string;
		const { schema } = await getListInfo.call(this, listId, infoCache);

		const values = getColumnValues.call(this, i, schema);
		const initialFields = buildCells.call(this, schema, values);

		const body: IDataObject = { list_id: listId };
		if (initialFields.length) {
			body.initial_fields = initialFields;
		}

		const response = await slackApiRequest.call(this, 'POST', '/slackLists.items.create', body);
		const item = response.item as IDataObject | undefined;
		if (!item) return { success: true };

		const simplify = this.getNodeParameter('simplify', i, true) as boolean;
		return simplify ? simplifyItem(item, schema) : item;
	});
}
