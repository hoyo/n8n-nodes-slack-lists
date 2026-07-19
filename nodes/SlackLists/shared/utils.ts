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

/** Splits a comma-separated ID string into a trimmed, non-empty array */
export function splitIds(value: string): string[] {
	return value
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id !== '');
}
