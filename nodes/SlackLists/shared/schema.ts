import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { slackApiRequest } from './transport';

export interface ListColumnChoice {
	value: string;
	label: string;
	color?: string;
}

export interface ListColumn {
	id: string;
	name: string;
	key: string;
	type: string;
	is_primary_column?: boolean;
	options?: {
		format?: string;
		choices?: ListColumnChoice[];
		[key: string]: unknown;
	};
}

export interface ListInfo {
	id: string;
	title: string;
	schema: ListColumn[];
	todoMode: boolean;
	file: IDataObject;
}

/** Column types that cannot be written via the API */
export const READ_ONLY_COLUMN_TYPES = [
	'canvas',
	'created_by',
	'created_time',
	'last_edited_by',
	'last_edited_time',
	'reference',
	'vote',
];

/**
 * Fetches a List's metadata (including its column schema) via files.info.
 * Requires the files:read scope.
 */
export async function getListInfo(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	listId: string,
	cache?: Map<string, ListInfo>,
): Promise<ListInfo> {
	const cached = cache?.get(listId);
	if (cached) return cached;

	const response = await slackApiRequest.call(this, 'GET', '/files.info', {}, { file: listId });
	const file = response.file as IDataObject | undefined;
	const metadata = file?.list_metadata as IDataObject | undefined;

	if (!file || !metadata) {
		throw new NodeOperationError(
			this.getNode(),
			`The file "${listId}" is not a Slack List or its metadata could not be retrieved`,
		);
	}

	const info: ListInfo = {
		id: file.id as string,
		title: (file.title as string) ?? '',
		schema: (metadata.schema as ListColumn[]) ?? [],
		todoMode: (metadata.todo_mode as boolean) ?? false,
		file,
	};
	cache?.set(listId, info);
	return info;
}
