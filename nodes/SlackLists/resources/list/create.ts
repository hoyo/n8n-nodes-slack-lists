import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { jsonParse, NodeOperationError } from 'n8n-workflow';
import { toRichTextBlocks } from '../../shared/cells';
import { slackApiRequest } from '../../shared/transport';
import { processItems } from '../../shared/utils';

const show = {
	resource: ['list'],
	operation: ['create'],
};

export const listCreateDescription: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'The name of the List to create',
		displayOptions: { show },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add field',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Copy From List ID',
				name: 'copyFromListId',
				type: 'string',
				default: '',
				placeholder: 'F0123ABCDEF',
				description: 'ID of an existing List to copy the schema (and optionally records) from',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				description: 'A plain-text description of the List',
			},
			{
				displayName: 'Include Copied List Records',
				name: 'includeCopiedListRecords',
				type: 'boolean',
				default: false,
				description: 'Whether to also copy the records when copying from an existing List',
			},
			{
				displayName: 'Schema (JSON)',
				name: 'schema',
				type: 'json',
				default: '',
				description:
					'Column definitions as a JSON array, e.g. [{"name": "Status", "key": "status", "type": "select", "options": {"choices": [{"value": "open", "label": "Open"}]}}]. See the slackLists.create documentation for available column types.',
			},
			{
				displayName: 'Todo Mode',
				name: 'todoMode',
				type: 'boolean',
				default: false,
				description:
					'Whether to enable the built-in task-tracking columns (Completed, Assignee, Due Date)',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return await processItems.call(this, items, async function (i) {
		const name = this.getNodeParameter('name', i) as string;
		const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

		const body: IDataObject = { name };

		if (additionalFields.description) {
			body.description_blocks = toRichTextBlocks(additionalFields.description as string);
		}
		if (additionalFields.todoMode) {
			body.todo_mode = true;
		}
		if (additionalFields.copyFromListId) {
			body.copy_from_list_id = additionalFields.copyFromListId;
			if (additionalFields.includeCopiedListRecords) {
				body.include_copied_list_records = true;
			}
		}
		if (additionalFields.schema) {
			const schema =
				typeof additionalFields.schema === 'string'
					? jsonParse(additionalFields.schema, {
							errorMessage: 'The Schema field is not valid JSON',
						})
					: additionalFields.schema;
			if (!Array.isArray(schema)) {
				throw new NodeOperationError(this.getNode(), 'The Schema field must be a JSON array', {
					itemIndex: i,
				});
			}
			body.schema = schema;
		}

		const response = await slackApiRequest.call(this, 'POST', '/slackLists.create', body);
		const created = { ...response };
		delete created.ok;
		return created;
	});
}
