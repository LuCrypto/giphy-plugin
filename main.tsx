import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import "./styles.css";

interface GiphySettings {
  apiKey: string;
}

const DEFAULT_SETTINGS: GiphySettings = {
  apiKey: "",
};

export default class Giphy extends Plugin {
  settings: GiphySettings;

  async onload() {
    await this.loadSettings();

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: "add-random-gifs",
      name: "Add random gifs",
      editorCallback: async (editor: Editor) => {
        if (this.settings.apiKey === "") {
          new Notice(
            "Veuillez configurer votre clé API dans les paramètres du plugin.",
            0
          );
          (this.app as any).setting.open();
          (this.app as any).setting.openTabById("giphy-plugin");
          return;
        }
        const gifUrl = await fetchRandomGif(this.settings.apiKey);
        const cursor = editor.getCursor();
        editor.replaceRange(gifUrl + "\n\n", cursor);
      },
    });

    this.addCommand({
      id: "search-gifs",
      name: "Search gifs",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        if (this.settings.apiKey === "") {
          new Notice(
            "Veuillez configurer votre clé API dans les paramètres du plugin.",
            0
          );
          (this.app as any).setting.open();
          (this.app as any).setting.openTabById("giphy-plugin");
          return;
        }
        new GifModalSearch(
          this.app,
          (result: string, apiKey: string) => {
            const cursor = editor.getCursor();
            editor.replaceRange(result, cursor);
          },
          this.settings.apiKey
        ).open();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new GiphySettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// Get a random gif from the Giphy API
async function fetchRandomGif(apiKey: string): Promise<string> {
  if (apiKey === "") {
    new Notice(
      "Veuillez configurer votre clé API dans les paramètres du plugin.",
      0
    );
    (this.app as any).setting.open();
    (this.app as any).setting.openTabById("giphy-plugin");
    return "";
  }

  const response = await fetch(
    `https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=&rating=g`
  );
  const data = await response.json();
  return `![gif](${data.data.images.original.url})`;
}

// Get 25 gifs with a search bar
async function fetchGifs(search: string, apiKey: string): Promise<string[]> {
  if (apiKey === "") {
    new Notice(
      "Veuillez configurer votre clé API dans les paramètres du plugin.",
      0
    );
    (this.app as any).setting.open();
    (this.app as any).setting.openTabById("giphy-plugin");
    return [];
  }

  const response = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${search}&limit=25&offset=0&rating=g&lang=en&bundle=messaging_non_clips`
  );
  const data = await response.json();
  return data.data.map((gif: any) => gif.images.original.url);
}

class GifModalSearch extends Modal {
  onSubmit: (result: string, apiKeyValue: string) => void;
  apiKeyValue: string;

  constructor(
    app: App,
    onSubmit: (result: string, apiKeyValue: string) => void,
    apiKeyValue: string
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.apiKeyValue = apiKeyValue;
  }

  onOpen() {
    const { contentEl } = this;
    ReactDOM.createRoot(contentEl).render(
      <GifComponentSearch
        onSubmit={this.onSubmit}
        closeModal={() => this.close()}
        apiKey={this.apiKeyValue}
      />
    );
  }

  onClose() {
    const { contentEl } = this;
    const root = ReactDOM.createRoot(contentEl);
    root.unmount();
    contentEl.empty();
  }
}

const GifComponentSearch: React.FC<{
  apiKey: string;
  onSubmit: (result: string, apiKey: string) => void;
  closeModal: () => void;
}> = ({ apiKey, onSubmit, closeModal }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [gifs, setGifs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus sur l'input dès que le composant est monté
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  useEffect(() => {
    if (apiKey === "") {
      new Notice(
        "Veuillez configurer votre clé API dans les paramètres du plugin."
      );
      return;
    }
    fetchGifs(debouncedSearch, apiKey).then(setGifs);
  }, [debouncedSearch]);

  const handleGifClick = (gifUrl: string) => {
    onSubmit(`![gif](${gifUrl})\n\n`, apiKey);
    closeModal();
  };

  return (
    <div id="test">
      <div>
        <h1 id="test">Search for a gif</h1>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          placeholder="Search for a gif"
        />
      </div>
      <div id="groupGif">
        {gifs.map((gif, index) => (
          <img
            key={index}
            src={gif}
            alt="gif"
            onClick={() => handleGifClick(gif)}
          />
        ))}
      </div>
    </div>
  );
};

class GiphySettingTab extends PluginSettingTab {
  plugin: Giphy;

  constructor(app: App, plugin: Giphy) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Enter your Giphy API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
