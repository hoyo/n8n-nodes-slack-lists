import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { listRLC } from '../../shared/descriptions';
import { getListInfo } from '../../shared/schema';
import { processItems, toIsoString } from '../../shared/utils';

const show = {
	resource: ['list'],
	operation: ['get'],
};

export const listGetDescription: INodeProperties[] = [
	{
		...listRLC,
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
		const info = await getListInfo.call(this, listId);

		const simplify = this.getNodeParameter('simplify', i, true) as boolean;
		if (!simplify) return info.file;

		const file = info.file;
		const metadata = (file.list_metadata as IDataObject) ?? {};
		const limits = (file.list_limits as IDataObject) ?? {};
		return {
			id: info.id,
			title: info.title,
			description: metadata.description ?? '',
			todo_mode: info.todoMode,
			row_count: limits.row_count,
			archived_row_count: limits.archived_row_count,
			column_count: limits.column_count,
			created: toIsoString(file.created),
			updated: toIsoString(file.updated),
			permalink: file.permalink,
			schema: info.schema,
		};
	});
}
