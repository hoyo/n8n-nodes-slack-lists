import type { INodeProperties } from 'n8n-workflow';

export const listRLC: INodeProperties = {
	displayName: 'List',
	name: 'list',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Slack List to operate on',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'getLists',
				searchable: true,
			},
		},
		{
			displayName: 'By URL',
			name: 'url',
			type: 'string',
			placeholder: 'https://your-team.slack.com/lists/T0123456/F0123ABCDEF',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: 'https://[a-zA-Z0-9-.]+\\.slack\\.com/lists/[A-Z0-9]+/(F[A-Z0-9]+).*',
						errorMessage: 'Not a valid Slack List URL',
					},
				},
			],
			extractValue: {
				type: 'regex',
				regex: 'slack\\.com/lists/[A-Z0-9]+/(F[A-Z0-9]+)',
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'F0123ABCDEF',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: 'F[A-Z0-9]+',
						errorMessage: 'Not a valid Slack List ID (must start with F)',
					},
				},
			],
		},
	],
};
