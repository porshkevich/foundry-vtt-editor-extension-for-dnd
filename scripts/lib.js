export function mapObject(obj, fn) {
	return Object.fromEntries(Object.entries(obj).map(fn));
}

export function filterObject(obj, fn) {
	return Object.fromEntries(Object.entries(obj).filter(fn));
}

export const mapByLabel = ([k, v]) => [k, v.label];

export const mapByLabelConcatKey = ([k, v]) => [k, v.label.concat(" / ", capitalize(k))];

export const mapByLabelConcatFullKey = ([k, v]) => [k, v.label.concat(" / ", capitalize(v.fullKey))];

export const filterByReferenceExist = ([, v]) => "reference" in v;

const capitalize = ([first,...rest]) => first.toUpperCase() + rest.join('').toLowerCase();

export const extendLabels = selectChoises => {
	Object.keys(selectChoises).forEach( k => {
		if (selectChoises[k].children) {
			extendLabels(selectChoises[k].children)
		} else if (CONFIG.DND5E.toolIds[k]) {
			let item = getBaseItem(CONFIG.DND5E.toolIds[k])
			if (item.originalName)
				selectChoises[k].label += " / " + item.originalName
		}
	})
}

export function getBaseItem(id) {
	return game.system.documents.Trait.getBaseItem(id, { indexOnly: true });
}
