import type { INodeProperties } from 'n8n-workflow';
import { listCreateDescription } from './create';
import { listGetDescription } from './get';
import { listGrantAccessDescription } from './grantAccess';
import { listRevokeAccessDescription } from './revokeAccess';

export const listDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['list'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new List',
				action: 'Create a list',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a List’s metadata and column schema',
				action: 'Get a list',
			},
			{
				name: 'Grant Access',
				value: 'grantAccess',
				description: 'Grant users or channels access to a List',
				action: 'Grant access to a list',
			},
			{
				name: 'Revoke Access',
				value: 'revokeAccess',
				description: 'Revoke access to a List from users or channels',
				action: 'Revoke access to a list',
			},
		],
		default: 'create',
	},
	...listCreateDescription,
	...listGetDescription,
	...listGrantAccessDescription,
	...listRevokeAccessDescription,
];
