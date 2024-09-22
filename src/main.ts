import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, addIcon, TFile } from 'obsidian';

import { RecipeView, VIEW_TYPE_RECIPE } from './recipe-view';
import store from './store';
import { WHISK_SVG } from './whisk';

interface RecipeViewPluginSettings {
	sideColumnRegex: string;
	treatH1AsFilename: boolean;
	renderUnicodeFractions: boolean;
	singleColumnMaxWidth: number;
	showBulletsTwoColumn: boolean;
}

const DEFAULT_SETTINGS: RecipeViewPluginSettings = {
	sideColumnRegex: 'Ingredients|Nutrition',
	treatH1AsFilename: false,
	renderUnicodeFractions: true,
	singleColumnMaxWidth: 600,
	showBulletsTwoColumn: false,
}

export default class RecipeViewPlugin extends Plugin {
	settings: RecipeViewPluginSettings = DEFAULT_SETTINGS;
	
	private manualViewChange: boolean = false;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_RECIPE, (leaf) => new RecipeView(leaf, this));

		addIcon("recipe-whisk", WHISK_SVG)
		this.addRibbonIcon("recipe-whisk", "Toggle recipe view", () => {
			this.toggleView(false);
		});

		this.addCommand({
			id: "toggle-recipe-view",
			name: "Toggle between recipe card and markdown",
			checkCallback: (c) => this.toggleView(c),
		});
	
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', this.handleFileOpen.bind(this))
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RecipeViewSettingsTab(this.app, this));

		// Load style settings variables
		this.app.workspace.trigger("parse-style-settings");

		store.plugin.set(this);
	}

	onunload() {

	}
	
	async handleFileOpen() {
		const leaf = this.app.workspace.activeLeaf;
		const file = leaf?.view.file;
		
		// Skip handling the file change if the view was changed manually
		if (this.manualViewChange) {
			this.manualViewChange = false; // Reset the flag after handling
			return;
		}
		
		if (file instanceof TFile) {
			const fileCache = this.app.metadataCache.getFileCache(file);

			if (fileCache?.frontmatter && fileCache.frontmatter.tags) {
				
				if (fileCache.frontmatter.tags && fileCache.frontmatter.tags.some(tag => tag === 'recipe')) {
					this.setRecipeView(leaf!);
				}
			}
		}
	}

	toggleView(checking: boolean) {
		const activeLeaf = this.app.workspace.getMostRecentLeaf();
		
		// Set the flag to indicate that this is a manual view change
		this.manualViewChange = true;

		if (activeLeaf?.getViewState().type == "markdown") {
			if (!checking) {
				this.setRecipeView(activeLeaf!);
			}
		} else if (activeLeaf?.getViewState().type == VIEW_TYPE_RECIPE) {
			if (!checking) {
				this.setMarkdownView(activeLeaf!);
			}
		} else {
			return false;
		}
		return true;
	}

	async setRecipeView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: VIEW_TYPE_RECIPE,
			state: leaf.view.getState(),
			active: true,
			// @ts-ignore
			popstate: true,
		})
	}

	async setMarkdownView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: "markdown",
			state: leaf.view.getState(),
			active: true,
			// @ts-ignore
			popstate: true,
		})
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class RecipeViewSettingsTab extends PluginSettingTab {
	plugin: RecipeViewPlugin;

	constructor(app: App, plugin: RecipeViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Recipe parsing").setHeading()

		new Setting(containerEl)
			.setName('Side column regex')
			.setDesc('A regular expression for headings of sections to pull to the side column')
			.addText(text => text
				.setPlaceholder('Ingredients|Nutrition')
				.setValue(this.plugin.settings!.sideColumnRegex)
				.onChange(async (value) => {
					this.plugin.settings!.sideColumnRegex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Treat level one heading as filename')
			.setDesc('If turned on, then in recipes that have a "# Level one heading", there should only be one – and it will be used as the recipe title. Turn this on if you usually start your notes with a level one heading that matches the filename, and turn it off if you would ever use headings like "# Ingredients", "# Directons", etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.treatH1AsFilename)
				.onChange(async (value) => {
					this.plugin.settings!.treatH1AsFilename = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Recipe card appearance")
			.setDesc("More options are available using the style settings plugin.")
			.setHeading()

		new Setting(containerEl)
			.setName('Render fractions in quantities as unicode')
			.setDesc('If on, fractions will appear like e.g. "½ cup". If off, they will appear like e.g. "1/2 cup".')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.renderUnicodeFractions)
				.onChange(async (value) => {
					this.plugin.settings!.renderUnicodeFractions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Display ingredients in two-column view with bullets')
			.setDesc('If turned on, will display bullets for all checkable ingredient lists – not just in single-column view.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings!.showBulletsTwoColumn)
				.onChange(async (value) => {
					this.plugin.settings!.showBulletsTwoColumn = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum pixel width for single-column view')
			.setDesc('Recipe cards shown wider than this view will switch to two-column layout.')
			.addSlider(slider => slider
				.setDynamicTooltip()
				.setLimits(50, 2000, 10)
				.setValue(this.plugin.settings!.singleColumnMaxWidth)
				.onChange(async (value) => {
					this.plugin.settings!.singleColumnMaxWidth = value;
					await this.plugin.saveSettings()
				}))
	}
}
