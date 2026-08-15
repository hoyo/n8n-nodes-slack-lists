import type { INodeProperties } from 'n8n-workflow';
import { itemCreateDescription } from './create';
import { itemDeleteDescription } from './delete';
import { itemDeleteManyDescription } from './deleteMany';
import { itemGetDescription } from './get';
import { itemGetAllDescription } from './getAll';
import { itemUpdateDescription } from './update';

export const itemDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['item'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Add an item (row) to a List',
				action: 'Create an item',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an item (row) from a List',
				action: 'Delete an item',
			},
			{
				name: 'Delete Many',
				value: 'deleteMany',
				description: 'Delete multiple items (rows) from a List',
				action: 'Delete many items',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single item (row) from a List',
				action: 'Get an item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve items (rows) from a List',
				action: 'Get many items',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update cells of an item (row) in a List',
				action: 'Update an item',
			},
		],
		default: 'create',
	},
	...itemCreateDescription,
	...itemDeleteDescription,
	...itemDeleteManyDescription,
	...itemGetDescription,
	...itemGetAllDescription,
	...itemUpdateDescription,
];
