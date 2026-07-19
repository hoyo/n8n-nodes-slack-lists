import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { listRLC } from '../../shared/descriptions';
import { slackApiRequest } from '../../shared/transport';
import { processItems, splitIds } from '../../shared/utils';

const show = {
	resource: ['list'],
	operation: ['grantAccess'],
};

export const listGrantAccessDescription: INodeProperties[] = [
	{
		...listRLC,
		displayOptions: { show },
	},
	{
		displayName: 'Access Level',
		name: 'accessLevel',
		type: 'options',
		options: [
			{
				name: 'Owner',
				value: 'owner',
				description: 'Designate a user as owner of the List (users only, not channels)',
			},
			{
				name: 'Read',
				value: 'read',
				description: 'View-only access to the List',
			},
			{
				name: 'Write',
				value: 'write',
				description: 'Read and write access to the List',
			},
		],
		default: 'read',
		description: 'The permission level to grant',
		displayOptions: { show },
	},
	{
		displayName: 'Grant To',
		name: 'grantTo',
		type: 'options',
		options: [
			{
				name: 'Channels',
				value: 'channels',
			},
			{
				name: 'Users',
				value: 'users',
			},
		],
		default: 'users',
		description: 'Whether to grant access to users or to channels',
		displayOptions: { show },
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'U0123ABCD, U0456EFGH',
		description: 'Comma-separated IDs of the users to grant access to',
		displayOptions: {
			show: {
				...show,
				grantTo: ['users'],
			},
		},
	},
	{
		displayName: 'Channel IDs',
		name: 'channelIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'C0123ABCD, C0456EFGH',
		description: 'Comma-separated IDs of the channels to grant access to',
		displayOptions: {
			show: {
				...show,
				grantTo: ['channels'],
			},
		},
	},
];

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return await processItems.call(this, items, async function (i) {
		const listId = this.getNodeParameter('list', i, '', { extractValue: true }) as string;
		const accessLevel = this.getNodeParameter('accessLevel', i) as string;
		const grantTo = this.getNodeParameter('grantTo', i) as string;

		const body: IDataObject = { list_id: listId, access_level: accessLevel };
		if (grantTo === 'users') {
			body.user_ids = splitIds(this.getNodeParameter('userIds', i) as string);
		} else {
			body.channel_ids = splitIds(this.getNodeParameter('channelIds', i) as string);
		}

		await slackApiRequest.call(this, 'POST', '/slackLists.access.set', body);
		return { success: true };
	});
}
