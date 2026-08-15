import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import * as itemCreate from './item/create';
import * as itemDelete from './item/delete';
import * as itemDeleteMany from './item/deleteMany';
import * as itemGet from './item/get';
import * as itemGetAll from './item/getAll';
import * as itemUpdate from './item/update';
import * as listCreate from './list/create';
import * as listGet from './list/get';
import * as listGrantAccess from './list/grantAccess';
import * as listRevokeAccess from './list/revokeAccess';

type OperationExecute = (
	this: IExecuteFunctions,
	items: INodeExecutionData[],
) => Promise<INodeExecutionData[]>;

const operations: Record<string, Record<string, OperationExecute>> = {
	item: {
		create: itemCreate.execute,
		delete: itemDelete.execute,
		deleteMany: itemDeleteMany.execute,
		get: itemGet.execute,
		getAll: itemGetAll.execute,
		update: itemUpdate.execute,
	},
	list: {
		create: listCreate.execute,
		get: listGet.execute,
		grantAccess: listGrantAccess.execute,
		revokeAccess: listRevokeAccess.execute,
	},
};

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;

	// n8n injects a "Custom API Call" option into every node that references a
	// credential with an authenticate block; this node does not implement it.
	if (resource === '__CUSTOM_API_CALL__' || operation === '__CUSTOM_API_CALL__') {
		throw new NodeOperationError(
			this.getNode(),
			'Custom API Call is not supported by this node. Use the HTTP Request node with your Slack credential (Predefined Credential Type → Slack API) instead',
		);
	}

	const operationExecute = operations[resource]?.[operation];
	if (!operationExecute) {
		throw new NodeOperationError(
			this.getNode(),
			`The operation "${operation}" is not supported for resource "${resource}"`,
		);
	}

	return [await operationExecute.call(this, items)];
}
