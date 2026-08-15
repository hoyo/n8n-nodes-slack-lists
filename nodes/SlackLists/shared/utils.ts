import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/**
 * Runs an operation callback for every input item, collecting the results with
 * paired-item metadata and honoring "Continue on Fail".
 */
export async function processItems(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	fn: (this: IExecuteFunctions, itemIndex: number) => Promise<IDataObject | IDataObject[]>,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const responseData = await fn.call(this, i);
			returnData.push(
				...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(responseData), {
					itemData: { item: i },
				}),
			);
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
				continue;
			}
			const nodeError =
				error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			throw nodeError;
		}
	}

	return returnData;
}

/**
 * Converts a Slack timestamp (unix seconds, sometimes delivered as a string) to
 * an ISO 8601 string, so outputs are directly usable in n8n expressions.
 *
 * Returns undefined for missing or unparsable values, which drops the field from
 * the output rather than surfacing an "Invalid Date".
 */
export function toIsoString(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const seconds = Number(value);
	if (!Number.isFinite(seconds)) return undefined;
	return new Date(seconds * 1000).toISOString();
}

/** Splits a comma-separated ID string into a trimmed, non-empty array */
export function splitIds(value: string): string[] {
	return value
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id !== '');
}
