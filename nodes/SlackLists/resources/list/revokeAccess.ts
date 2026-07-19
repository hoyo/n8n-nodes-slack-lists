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
	operation: ['revokeAccess'],
};

export const listRevokeAccessDescription: INodeProperties[] = [
	{
		...listRLC,
		displayOptions: { show },
	},
	{
		displayName: 'Revoke From',
		name: 'revokeFrom',
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
		description: 'Whether to revoke access from users or from channels',
		displayOptions: { show },
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'U0123ABCD, U0456EFGH',
		description: 'Comma-separated IDs of the users to revoke access from',
		displayOptions: {
			show: {
				...show,
				revokeFrom: ['users'],
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
		description: 'Comma-separated IDs of the channels to revoke access from',
		displayOptions: {
			show: {
				...show,
				revokeFrom: ['channels'],
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
		const revokeFrom = this.getNodeParameter('revokeFrom', i) as string;

		const body: IDataObject = { list_id: listId };
		if (revokeFrom === 'users') {
			body.user_ids = splitIds(this.getNodeParameter('userIds', i) as string);
		} else {
			body.channel_ids = splitIds(this.getNodeParameter('channelIds', i) as string);
		}

		await slackApiRequest.call(this, 'POST', '/slackLists.access.delete', body);
		return { success: true };
	});
}
