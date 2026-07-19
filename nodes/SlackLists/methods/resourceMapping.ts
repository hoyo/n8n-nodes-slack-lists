import type {
	FieldType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';
import type { ListColumn } from '../shared/schema';
import { getListInfo, READ_ONLY_COLUMN_TYPES } from '../shared/schema';

function mapColumnType(column: ListColumn): FieldType {
	const isMulti = column.options?.format?.startsWith('multi_');
	switch (column.type) {
		case 'checkbox':
		case 'todo_completed':
			return 'boolean';
		case 'number':
		case 'rating':
			return 'number';
		case 'date':
		case 'todo_due_date':
		case 'timestamp':
			return 'dateTime';
		case 'select':
			return isMulti ? 'array' : 'options';
		case 'user':
		case 'todo_assignee':
		case 'channel':
			return isMulti ? 'array' : 'string';
		case 'link':
			return 'url';
		case 'attachment':
			return 'array';
		default:
			return 'string';
	}
}

/**
 * Resolves the selected List's schema into resourceMapper fields.
 * Used by the Item Create / Item Update column mapping UI.
 */
export async function getColumns(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
	const listId = this.getNodeParameter('list', undefined, { extractValue: true }) as string;
	const { schema } = await getListInfo.call(this, listId);

	const fields: ResourceMapperField[] = schema
		.filter((column) => !READ_ONLY_COLUMN_TYPES.includes(column.type))
		.map((column) => {
			let options: INodePropertyOptions[] | undefined;
			if (column.type === 'select') {
				options = (column.options?.choices ?? []).map((choice) => ({
					name: choice.label,
					value: choice.value,
				}));
			}
			return {
				id: column.id,
				displayName: column.name,
				required: false,
				defaultMatch: false,
				canBeUsedToMatch: false,
				display: true,
				type: mapColumnType(column),
				options,
				readOnly: false,
			};
		});

	return { fields };
}
