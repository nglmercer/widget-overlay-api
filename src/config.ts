import fs from "fs";
import path from "path";

interface Config {
  port: number;
  host: string;
}

class ConfigManager {
  static readonly DEFAULT_CONFIG: Config = {
    port: 21100,
    host: "0.0.0.0",
  };

  static readonly CONFIG_PATH = path.join(process.cwd(), "config.json");

  static readConfigFile(): string {
    return fs.readFileSync(ConfigManager.CONFIG_PATH, "utf8");
  }

  static writeConfigFile(data: any): void {
    fs.writeFileSync(ConfigManager.CONFIG_PATH, JSON.stringify(data, null, 2));
  }

  static loadConfig(): Config {
    try {
      const configFile = ConfigManager.readConfigFile();
      const config = JSON.parse(configFile) as Partial<Config>;

      if (config.port === 0) {
        config.port = ConfigManager.DEFAULT_CONFIG.port;
      }

      return { ...ConfigManager.DEFAULT_CONFIG, ...config };
    } catch (error) {
      console.warn("Error loading config:", error);
      return ConfigManager.DEFAULT_CONFIG;
    }
  }

  static createConfigFile(): void {
    try {
      try {
        fs.accessSync(ConfigManager.CONFIG_PATH);
      } catch {
        ConfigManager.writeConfigFile(ConfigManager.DEFAULT_CONFIG);
      }
    } catch (error) {
      console.warn("⚠️ Error creating config.json:", error);
    }
  }

  static saveConfig(config: Partial<Config>): void {
    try {
      const currentConfig = JSON.parse(ConfigManager.readConfigFile()) as Config;
      const updatedConfig = { ...currentConfig, ...config };
      ConfigManager.writeConfigFile(updatedConfig);
    } catch (error) {
      console.warn("⚠️ Error saving config.json:", error);
    }
  }
}

export const { loadConfig, createConfigFile, saveConfig } = ConfigManager;
