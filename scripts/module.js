import * as lib from "./lib.js";

Hooks.once("init", async () => {
	if (game.system.id.toLowerCase() !== "dnd5e") {
		new Dialog({
			title: "Editor extension for DnD",
			content: `<p>${i18n("EEFDND.WorkOnly")}</p>`,
			buttons: {
				done: {
					label: "Хорошо",
				},
			},
		}).render(true);
		return;
	}

	const extension = new EditorEnrichersExtension();

	Hooks.on("getProseMirrorMenuDropDowns", (pmmenu, menus) => {
		return extension.registerNewProseMirrorMenuDropDowns(pmmenu, menus);
	});

	extension.registerHandlebarsHelpers();
});

function concat_notnull(...values) {
	const options = values.pop();
	const join = options.hash?.join || "";
	return new Handlebars.SafeString(values.filter((item) => item).join(join));
}

const i18n = (key) => {
	return game.i18n.localize(key);
};
const i18nFormat = (key, data = {}) => {
	return game.i18n.format(key, data);
};

class EditorEnrichersExtension {
	static get OUTPUT_TEMPLATES() {
		return {
			check: Handlebars.compile(
				'[[/check {{concat-notnull passive ability dc format join=" "}}]]{{#if (and wrap selected)}}{ {{~selected~}} }{{/if}}',
			),
			save: Handlebars.compile(
				'[[/save {{concat-notnull ability dc format join=" "}}]]{{#if (and wrap selected)}}{ {{~selected~}} }{{/if}}',
			),
			skill: Handlebars.compile(
				'[[/skill {{concat-notnull passive ability skill dc format join=" "}}]]{{#if (and wrap selected)}}{ {{~selected~}} }{{/if}}',
			),
			tool: Handlebars.compile(
				'[[/tool {{concat-notnull ability tool dc format join=" "}}]]{{#if (and wrap selected)}}{ {{~selected~}} }{{/if}}',
			),
			damage: Handlebars.compile(
				'[[/damage {{concat-notnull formula damageType average join=" "}}]]',
			),
			healing: Handlebars.compile(
				'[[/healing {{concat-notnull formula temp average join=" "}}]]',
			),
			reference: Handlebars.compile(
				"&Reference[{{value}}]{{#if (and wrap selected)}}{ {{~selected~}} }{{/if}}",
			),
		};
	}

	registerHandlebarsHelpers() {
		Handlebars.registerHelper({
			"concat-notnull": concat_notnull,
		});
	}

	registerNewProseMirrorMenuDropDowns(pmmenu, menus) {
		menus.enrichers = {
			action: "enrichers",
			title: "Enrichers",
			cssClass: "enrichers",
			icon: '<i class="fa-brands fa-etsy" aria-hidden="true"></i>',
			entries: [
				{
					action: "enrichers-check",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.ActionAbil"),
					}),
					cmd: this._insertCheckPrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-save",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.ActionSave"),
					}),
					cmd: this._insertSavePrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-skill",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.Skill"),
					}),
					cmd: this._insertSkillPrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-tool",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("TYPES.Item.tool"),
					}),
					cmd: this._insertToolPrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-damage",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.Damage"),
					}),
					cmd: this._insertDamagePrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-healing",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.Healing"),
					}),
					cmd: this._insertHealingPrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-condition",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.Rule.Type.Condition"),
					}),
					cmd: this._insertConditionPrompt.bind(this, pmmenu),
				},
				{
					action: "enrichers-spellSchool",
					title: i18nFormat("EEFDND.AddEnricher", {
						enricher: i18n("DND5E.SpellSchool"),
					}),
					cmd: this._insertSpellSchoolPrompt.bind(this, pmmenu),
				},
			],
		};
		return menus;
	}

	async _insertCheckPrompt(pmmenu) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
			choices: EditorEnrichersExtension._getAbilityChoices(),
		};
		const dialog = await pmmenu._showDialog(
			"enrichers-check",
			"modules/editor-extension-for-dnd/templates/insert-check.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				ability: form.elements.ability.value,
				dc: form.elements.dc.value,
			};
			if (form.elements.passive.checked) {
				data.passive = form.elements.passive.value;
			}
			if (form.elements.wrap.checked) {
				data.wrap = form.elements.wrap.value;
			}
			if (form.elements.format.checked) {
				data.format = `format=${form.elements.format.value}`;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.check(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	async _insertSavePrompt(pmmenu) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
			choices: EditorEnrichersExtension._getAbilityChoices(),
		};
		const dialog = await pmmenu._showDialog(
			"enrichers-save",
			"modules/editor-extension-for-dnd/templates/insert-save.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				ability: form.elements.ability.value,
				dc: form.elements.dc.value,
			};
			if (form.elements.wrap.checked) {
				data.wrap = form.elements.wrap.value;
			}
			if (form.elements.format.checked) {
				data.format = `format=${form.elements.format.value}`;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.save(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	async _insertSkillPrompt(pmmenu) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
			abilityChoices: EditorEnrichersExtension._getAbilityChoicesWithEmpty(),
			skillChoices: EditorEnrichersExtension._getSkillChoices(),
		};
		const dialog = await pmmenu._showDialog(
			"enrichers-skill",
			"modules/editor-extension-for-dnd/templates/insert-skill.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				skill: form.elements.skill.value,
				ability: form.elements.ability.value,
				dc: form.elements.dc.value,
			};
			if (form.elements.wrap.checked) {
				data.wrap = form.elements.wrap.value;
			}
			if (form.elements.format.checked) {
				data.format = `format=${form.elements.format.value}`;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.skill(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	async _insertToolPrompt(pmmenu) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
			abilityChoices: EditorEnrichersExtension._getAbilityChoices(),
			toolChoices: EditorEnrichersExtension._getToolChoices(),
		};
		const dialog = await pmmenu._showDialog(
			"enrichers-tool",
			"modules/editor-extension-for-dnd/templates/insert-tool.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				tool: form.elements.tool.value,
				ability: form.elements.ability.value,
				dc: form.elements.dc.value,
			};
			if (form.elements.wrap.checked) {
				data.wrap = form.elements.wrap.value;
			}
			if (form.elements.format.checked) {
				data.format = `format=${form.elements.format.value}`;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.tool(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	async _insertDamagePrompt(pmmenu) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
			damageTypeChoices:
				EditorEnrichersExtension._getDamageTypeChoicesWithEmpty(),
		};
		const dialog = await pmmenu._showDialog(
			"enrichers-damage",
			"modules/editor-extension-for-dnd/templates/insert-damage.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				formula: form.elements.formula.value,
				damageType: form.elements.damageType.value,
			};
			if (form.elements.average.checked) {
				data.average = `average=${form.elements.averageValue.value || "true"}`;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.damage(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	async _insertHealingPrompt(pmmenu) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
		};
		const dialog = await pmmenu._showDialog(
			"enrichers-healing",
			"modules/editor-extension-for-dnd/templates/insert-healing.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				formula: form.elements.formula.value,
			};
			if (form.elements.temp.checked) {
				data.temp = form.elements.temp.value;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.healing(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	async _insertConditionPrompt(pmmenu) {
		this._insertReferencePrompt(
			pmmenu,
			"enrichers-condition",
			"DND5E.Rule.Type.Condition",
			EditorEnrichersExtension._getConditionChoices(),
		);
	}

	async _insertSpellSchoolPrompt(pmmenu) {
		this._insertReferencePrompt(
			pmmenu,
			"enrichers-spellSchool",
			"DND5E.SpellSchool",
			EditorEnrichersExtension._getSpellSchoolChoices(),
		);
	}

	async _insertReferencePrompt(pmmenu, action, label, choices) {
		const selectedText = EditorEnrichersExtension._getSelectedText(pmmenu);
		const data = {
			selected: selectedText,
			label: label,
			choices: choices,
		};
		const dialog = await pmmenu._showDialog(
			action,
			"modules/editor-extension-for-dnd/templates/insert-reference.hbs",
			{ data },
		);
		const form = dialog.querySelector("form");
		form.elements.save.addEventListener("click", () => {
			const data = {
				selected: selectedText,
				value: form.elements.value.value,
			};
			if (form.elements.wrap.checked) {
				data.wrap = form.elements.wrap.value;
			}
			pmmenu.view.dispatch(
				pmmenu.view.state.tr
					.replaceSelectionWith(
						pmmenu.schema.text(
							EditorEnrichersExtension.OUTPUT_TEMPLATES.reference(data),
						),
					)
					.scrollIntoView(),
			);
		});
	}

	static _getSelectedText(pmmenu) {
		const state = pmmenu.view.state;
		const { $from, empty } = state.selection;
		if (!empty) {
			const selected = state.doc.nodeAt($from.pos);
			return selected?.text ?? "";
		}
		return "";
	}

	static _getAbilityChoices() {
		return lib.mapObject(CONFIG.DND5E.abilities, lib.mapByLabel);
	}

	static _getAbilityChoicesWithEmpty() {
		return Object.assign(
			{ "": "" },
			EditorEnrichersExtension._getAbilityChoices(),
		);
	}

	static _getSkillChoices() {
		return lib.mapObject(CONFIG.DND5E.skills, lib.mapByLabel);
	}

	static _getToolChoices() {
		return lib.mapObject(CONFIG.DND5E.toolIds, ([k, v]) => [
			k,
			lib.getBaseItem(v).name,
		]);
	}

	static _getDamageTypeChoices() {
		return lib.mapObject(CONFIG.DND5E.damageTypes, lib.mapByLabel);
	}

	static _getDamageTypeChoicesWithEmpty() {
		return Object.assign(
			{ "": "" },
			EditorEnrichersExtension._getDamageTypeChoices(),
		);
	}

	static _getConditionChoices() {
		return lib.mapObject(
			lib.filterObject(CONFIG.DND5E.conditionTypes, lib.filterByReferenceExist),
			lib.mapByLabel,
		);
	}

	static _getSpellSchoolChoices() {
		return lib.mapObject(CONFIG.DND5E.spellSchools, lib.mapByLabel);
	}
}
