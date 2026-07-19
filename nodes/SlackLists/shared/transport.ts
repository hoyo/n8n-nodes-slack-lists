import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type SlackContext = IExecuteFunctions | ILoadOptionsFunctions;

const ERROR_MESSAGES: Record<string, string> = {
	invalid_auth: 'The Slack access token is invalid',
	not_authed: 'No Slack access token was provided',
	token_revoked: 'The Slack access token has been revoked',
	paid_teams_only: 'Slack Lists are only available on paid Slack plans',
	list_not_found: 'The List could not be found. Check the List ID and that the token has access to it',
	access_denied: 'The token does not have access to this List',
	invalid_row_id: 'The row (item) ID is invalid',
	column_not_found: 'One of the referenced columns does not exist in this List',
	file_not_found: 'The List (file) could not be found. Check the List ID',
};

export async function slackApiRequest(
	this: SlackContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `https://slack.com/api${endpoint}`,
		body: Object.keys(body).length ? body : undefined,
		qs: Object.keys(qs).length ? qs : undefined,
		json: true,
	};

	let response: IDataObject;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'slackApi',
			options,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}

	if (response.ok !== true) {
		const errorCode = (response.error as string) ?? 'unknown_error';
		let message = ERROR_MESSAGES[errorCode];
		if (errorCode === 'missing_scope') {
			const needed = (response.needed as string) ?? 'unknown';
			message = `The Slack token is missing a required OAuth scope: "${needed}". Add it in your Slack app settings and reinstall the app`;
		}
		throw new NodeApiError(this.getNode(), response as JsonObject, {
			message: message ?? `Slack API error: ${errorCode}`,
			description: `The Slack API returned the error code "${errorCode}" for ${endpoint}`,
		});
	}

	return response;
}

export async function slackApiRequestAllItems(
	this: SlackContext,
	propertyName: string,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	maxResults?: number,
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	let cursor: string | undefined;

	do {
		if (cursor) {
			if (method === 'GET') {
				qs.cursor = cursor;
			} else {
				body.cursor = cursor;
			}
		}
		const response = await slackApiRequest.call(this, method, endpoint, { ...body }, { ...qs });
		returnData.push(...((response[propertyName] as IDataObject[]) ?? []));

		const metadata = response.response_metadata as IDataObject | undefined;
		cursor = (metadata?.next_cursor as string) || undefined;

		if (maxResults !== undefined && returnData.length >= maxResults) {
			return returnData.slice(0, maxResults);
		}
	} while (cursor);

	return returnData;
}
