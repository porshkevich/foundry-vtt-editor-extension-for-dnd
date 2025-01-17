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

	/* Настройка отображения подсказок на английском */
	game.settings.register("editor-extension-for-dnd", "displayFallbackHelpers", {
		name: i18n("EEFDND.settings.displayFallbackHelpers.name"),
		hint: i18n("EEFDND.settings.displayFallbackHelpers.hint"),
		type: Boolean,
		default: false,
		scope: "world",
		config: true,
		restricted: false,
		requiresReload: true
	});

	const extension = new EditorEnrichersExtension(
		game.settings.get("editor-extension-for-dnd", "displayFallbackHelpers")
	);

	Hooks.on("getProseMirrorMenuDropDowns", (pmmenu, menus) => {
		extension.registerNewProseMirrorMenuDropDowns(pmmenu, menus);
	});

	Hooks.on("getProseMirrorMenuItems", (pmmenu, items) => {
		extension.registerNewProseMirrorMenuItems(pmmenu, items);
	});

	extension.registerHandlebarsHelpers();

	if (libWrapper != undefined) {
		libWrapper.register('editor-extension-for-dnd', 'JournalPageSheet.defaultOptions', function (wrapped, ...args) {
			return foundry.utils.mergeObject(wrapped(), {
				width: 630
			})
		} );
	}

	Hooks.on(game.babele ? "babele.ready" : "ready", () => {
		extension.onReady()
	});
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
const toggleCase = (text) => {
	return [...text].map(function(current, index, stringArray) {
		if (current.toLowerCase() === current) {
			return current.toUpperCase(); // If a character is lowercase, switch to uppercase
		} else {
			return current.toLowerCase(); // Else, switch to lowercase
		}
	}).join('');
}

class EditorEnrichersExtension {

	constructor(displayFallbackHelpers) {
		this._displayFallbackHelpers = displayFallbackHelpers
	}

	async onReady() {
		this._toolChoises = await game.system.documents.Trait.choices("tool")
		if (this.displayFallbackHelpers) lib.extendLabels(this._toolChoises)
	}

	get displayFallbackHelpers()  {
		return this._displayFallbackHelpers && game.i18n.lang !== "en"
	}

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
			toolChoices: this._getToolChoices(),
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
				this._getDamageTypeChoicesWithEmpty(),
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
			this._getConditionChoices(),
		);
	}

	async _insertSpellSchoolPrompt(pmmenu) {
		this._insertReferencePrompt(
			pmmenu,
			"enrichers-spellSchool",
			"DND5E.SpellSchool",
			this._getSpellSchoolChoices(),
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
		const { from, to, empty } = state.selection;

		return !empty ? state.doc.textBetween(from, to) ?? "" : ""
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

	_getToolChoices() {
		return this._toolChoises
	}

	_getDamageTypeChoices() {
		return lib.mapObject(
			CONFIG.DND5E.damageTypes,
			this.displayFallbackHelpers ? lib.mapByLabelConcatKey : lib.mapByLabel
		);
	}

	_getDamageTypeChoicesWithEmpty() {
		return Object.assign(
			{ "": "" },
			this._getDamageTypeChoices(),
		);
	}

	_getConditionChoices() {
		return lib.mapObject(
			lib.filterObject(CONFIG.DND5E.conditionTypes, lib.filterByReferenceExist),
			this.displayFallbackHelpers ? lib.mapByLabelConcatKey : lib.mapByLabel,
		);
	}

	_getSpellSchoolChoices() {
		return lib.mapObject(
			CONFIG.DND5E.spellSchools,
			this.displayFallbackHelpers ? lib.mapByLabelConcatFullKey : lib.mapByLabel,
		);
	}

	registerNewProseMirrorMenuItems(pmmenu, items) {
		const scopes = pmmenu.constructor._MENU_ITEM_SCOPES;
		items.unshift(
			{
				action: "toogleCase",
				title: i18n("EEFDND.ToggleCase"),
				icon: '<i class="fa-solid fa-font-case"></i>',
				scope: scopes.TEXT,
				cmd: this._toggleCase.bind(this, pmmenu)
			}
		);
	}

	async _toggleCase(pmmenu) {
		const state = pmmenu.view.state
		let tr = state.tr;
		const selection = tr.selection;
		if (selection.empty)
			return

		// check we will actually need a to dispatch transaction
		let shouldUpdate = false;

		state.doc.nodesBetween(selection.from, selection.to, (node, position) => {
			// we only processing text, must be a selection
			if (!node.isText || selection.from === selection.to) return;

			// calculate the section to replace
			const startPosition = Math.max(position, selection.from);
			const endPosition = Math.min(position + node.nodeSize, selection.to);

			// grab the content
			const substringFrom = Math.max(0, selection.from - position);
			const substringTo = Math.max(0, selection.to - position);
			const updatedText = node.textContent.substring(substringFrom, substringTo);

			// replace
			tr = tr.insertText(toggleCase(updatedText), startPosition, endPosition)
			shouldUpdate = true;
		});

		if (shouldUpdate) {
			tr.setSelection(selection.map(tr.doc, tr.mapping))
			pmmenu.view.dispatch(tr.scrollIntoView());
			// Hack for bad work prosemirror and dom selection
			const {node: anchorNode, offset: anchorOffset} = pmmenu.view.domAtPos(selection.from)
			const {node: focusNode, offset: focusOffset} = pmmenu.view.domAtPos(selection.to)
			document.getSelection().setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset)
		}
	}
}
