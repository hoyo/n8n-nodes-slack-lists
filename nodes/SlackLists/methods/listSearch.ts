import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { slackApiRequest } from '../shared/transport';

/**
 * Searches Slack Lists visible to the token via files.list (types=list).
 * Requires the files:read scope. List templates (filetype "list_template")
 * are excluded.
 */
export async function getLists(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken ? +paginationToken : 1;

	const response = await slackApiRequest.call(
		this,
		'GET',
		'/files.list',
		{},
		{ types: 'list', count: 100, page },
	);

	let files = (response.files as IDataObject[]) ?? [];
	files = files.filter((file) => file.filetype === 'list');
	if (filter) {
		const search = filter.toLowerCase();
		files = files.filter((file) => ((file.title as string) ?? '').toLowerCase().includes(search));
	}

	const results: INodeListSearchItems[] = files.map((file) => ({
		name: (file.title as string) || (file.id as string),
		value: file.id as string,
		url: file.permalink as string,
	}));

	const paging = response.paging as IDataObject | undefined;
	const nextPage =
		paging && (paging.page as number) < (paging.pages as number)
			? String((paging.page as number) + 1)
			: undefined;

	return { results, paginationToken: nextPage };
}
