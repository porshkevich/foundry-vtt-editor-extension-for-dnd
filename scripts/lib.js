export function mapObject(obj, fn) {
	return Object.fromEntries(Object.entries(obj).map(fn));
}

export function filterObject(obj, fn) {
	return Object.fromEntries(Object.entries(obj).filter(fn));
}

export const mapByLabel = ([k, v]) => [k, v.label];

export const filterByReferenceExist = ([, v]) => "reference" in v;

export function getBaseItem(id) {
	return game.system.documents.Trait.getBaseItem(id, { indexOnly: true });
}
