import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { ListColumn } from './schema';
import { READ_ONLY_COLUMN_TYPES } from './schema';

/** Wraps plain text into the minimal rich_text block structure Slack expects for text cells */
export function toRichTextBlocks(text: string): IDataObject[] {
	return [
		{
			type: 'rich_text',
			elements: [
				{
					type: 'rich_text_section',
					elements: [{ type: 'text', text }],
				},
			],
		},
	];
}

function toArray(value: unknown): unknown[] {
	if (value === null || value === undefined || value === '') return [];
	if (Array.isArray(value)) return value;
	if (typeof value === 'string' && value.includes(',')) {
		return value
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry !== '');
	}
	return [value];
}

function toDateString(value: unknown): string {
	const date = new Date(value as string);
	if (isNaN(date.getTime())) return String(value);
	return date.toISOString().slice(0, 10);
}

function toUnixTimestamp(value: unknown): number {
	if (typeof value === 'number') return value;
	const date = new Date(value as string);
	if (isNaN(date.getTime())) return Number(value);
	return Math.floor(date.getTime() / 1000);
}

/**
 * Builds the type-specific value part of a cell object for
 * slackLists.items.create (initial_fields) and slackLists.items.update (cells).
 */
export function buildCellValue(column: ListColumn, value: unknown): IDataObject {
	switch (column.type) {
		case 'text':
			if (Array.isArray(value)) {
				// Already rich_text blocks (advanced input)
				return { rich_text: value };
			}
			return { rich_text: toRichTextBlocks(String(value ?? '')) };
		case 'select':
			return { select: toArray(value) };
		case 'user':
		case 'todo_assignee':
			return { user: toArray(value) };
		case 'channel':
			return { channel: toArray(value) };
		case 'email':
			return { email: toArray(value) };
		case 'phone':
			return { phone: toArray(value) };
		case 'number':
			return { number: toArray(value).map(Number) };
		case 'rating':
			return { rating: toArray(value).map(Number) };
		case 'checkbox':
		case 'todo_completed':
			return { checkbox: Boolean(value) };
		case 'date':
		case 'todo_due_date':
			return { date: toArray(value).map(toDateString) };
		case 'timestamp':
			return { timestamp: toArray(value).map(toUnixTimestamp) };
		case 'link':
			return {
				link: toArray(value).map((entry) =>
					typeof entry === 'object' ? entry : { original_url: String(entry) },
				),
			};
		case 'message':
			return { message: toArray(value) };
		case 'attachment':
			return { attachment: toArray(value) };
		default:
			return { rich_text: toRichTextBlocks(String(value ?? '')) };
	}
}

/**
 * Converts a record of { columnId: value } into the cells array used by the
 * items.create / items.update endpoints.
 */
export function buildCells(
	this: IExecuteFunctions,
	schema: ListColumn[],
	values: IDataObject,
): IDataObject[] {
	const cells: IDataObject[] = [];
	for (const [columnId, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === '') continue;
		const column = schema.find((col) => col.id === columnId);
		if (!column) {
			throw new NodeOperationError(
				this.getNode(),
				`Column "${columnId}" was not found in the List schema`,
			);
		}
		if (READ_ONLY_COLUMN_TYPES.includes(column.type)) continue;
		cells.push({ column_id: columnId, ...buildCellValue(column, value) });
	}
	return cells;
}

/**
 * Resolves the resourceMapper "columns" parameter into { columnId: value },
 * supporting both defineBelow and autoMapInputData mapping modes.
 * In autoMapInputData mode, input JSON keys are matched against column names,
 * column IDs and column keys.
 */
export function getColumnValues(
	this: IExecuteFunctions,
	itemIndex: number,
	schema: ListColumn[],
): IDataObject {
	const mappingMode = this.getNodeParameter('columns.mappingMode', itemIndex, 'defineBelow') as string;

	if (mappingMode === 'autoMapInputData') {
		const inputData = this.getInputData()[itemIndex].json;
		const values: IDataObject = {};
		for (const column of schema) {
			if (READ_ONLY_COLUMN_TYPES.includes(column.type)) continue;
			for (const candidate of [column.name, column.id, column.key]) {
				if (candidate !== undefined && candidate in inputData) {
					values[column.id] = inputData[candidate];
					break;
				}
			}
		}
		return values;
	}

	return (this.getNodeParameter('columns.value', itemIndex, {}) as IDataObject) ?? {};
}

function isSingleFormat(column: ListColumn | undefined): boolean {
	const format = column?.options?.format;
	return format === 'single_entity' || format === 'single_select';
}

function collapse(values: unknown[] | undefined, column: ListColumn | undefined): unknown {
	if (!Array.isArray(values)) return values ?? null;
	if (isSingleFormat(column) || values.length <= 1) return values[0] ?? null;
	return values;
}

/**
 * Converts a raw List item (record) into a simplified object:
 * fields keyed by column name with plain values.
 */
export function simplifyItem(record: IDataObject, schema: ListColumn[]): IDataObject {
	const columnsById = new Map(schema.map((col) => [col.id, col]));
	const fields: IDataObject = {};

	for (const field of (record.fields as IDataObject[]) ?? []) {
		const column = columnsById.get(field.column_id as string);
		const name = column?.name ?? (field.key as string) ?? (field.column_id as string);
		fields[name] = extractFieldValue(field, column) as IDataObject[string];
	}

	return {
		id: record.id,
		list_id: record.list_id,
		date_created: record.date_created,
		created_by: record.created_by,
		updated_by: record.updated_by,
		updated_timestamp: record.updated_timestamp,
		...(record.parent_record_id ? { parent_record_id: record.parent_record_id } : {}),
		fields,
	};
}

function extractFieldValue(field: IDataObject, column: ListColumn | undefined): unknown {
	if (field.text !== undefined) return field.text;
	if (field.checkbox !== undefined) return field.checkbox;
	if (field.user !== undefined) return collapse(field.user as unknown[], column);
	if (field.select !== undefined) return collapse(field.select as unknown[], column);
	if (field.email !== undefined) return collapse(field.email as unknown[], column);
	if (field.phone !== undefined) return collapse(field.phone as unknown[], column);
	if (field.channel !== undefined) return collapse(field.channel as unknown[], column);
	if (field.number !== undefined) return collapse(field.number as unknown[], column);
	if (field.rating !== undefined) return collapse(field.rating as unknown[], column);
	if (field.date !== undefined) return collapse(field.date as unknown[], column);
	if (field.timestamp !== undefined) return collapse(field.timestamp as unknown[], column);
	if (field.link !== undefined) {
		const links = (field.link as IDataObject[]).map((entry) => entry.original_url ?? entry);
		return collapse(links, column);
	}
	if (field.message !== undefined) return collapse(field.message as unknown[], column);
	if (field.attachment !== undefined) return field.attachment;
	return field.value ?? null;
}
