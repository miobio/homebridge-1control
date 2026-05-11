'use strict';

const { OneControlClient } = require('./client');
const { OneControlAccessory } = require('./accessory');

const PLUGIN_NAME = 'homebridge-1control';
const PLATFORM_NAME = '1ControlPlatform';

/**
 * Homebridge Platform for 1Control.eu
 * Manages multiple accessories (buttons) configured by the user
 */
class OneControlPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = [];

    // Validate minimum required configuration
    if (!config || !config.username || !config.password) {
      this.log.error('[1Control] ❌ Missing configuration: "username" and "password" are required.');
      return;
    }

    if (!config.buttons || !Array.isArray(config.buttons) || config.buttons.length === 0) {
      this.log.error('[1Control] ❌ No buttons configured. Please add at least one entry in "buttons".');
      return;
    }

    // Create a shared client for all accessories
    this.client = new OneControlClient(
      this.log,
      config.username,
      config.password
    );

    this.log.info(`[1Control] Plugin loaded. ${config.buttons.length} button(s) configured.`);

    // Register accessories once Homebridge has finished launching
    if (this.api) {
      this.api.on('didFinishLaunching', () => {
        this.log.info('[1Control] Homebridge launched. Registering accessories...');
        this.discoverDevices();
      });
    }
  }

  /**
   * Called by Homebridge when restoring cached accessories
   */
  configureAccessory(accessory) {
    this.log.info(`[1Control] Loading accessory from cache: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  /**
   * Registers configured buttons as HomeKit accessories
   */
  discoverDevices() {
    for (const buttonConfig of this.config.buttons) {
      if (!buttonConfig.name || !buttonConfig.selector) {
        this.log.warn('[1Control] ⚠️ Skipping button: missing "name" or "selector".');
        continue;
      }

      // Generate a unique UUID based on name and selector
      const uuid = this.api.hap.uuid.generate(
        PLUGIN_NAME + ':' + buttonConfig.name + ':' + buttonConfig.selector
      );

      // Check if the accessory already exists in cache
      const existingAccessory = this.accessories.find(acc => acc.UUID === uuid);

      if (existingAccessory) {
        this.log.info(`[1Control] Restoring accessory from cache: ${buttonConfig.name}`);
        new OneControlAccessory(this, existingAccessory, buttonConfig, this.client);
      } else {
        this.log.info(`[1Control] Registering new accessory: ${buttonConfig.name}`);
        const accessory = new this.api.platformAccessory(buttonConfig.name, uuid);
        new OneControlAccessory(this, accessory, buttonConfig, this.client);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    // Remove obsolete accessories (no longer in config)
    const configuredUUIDs = this.config.buttons.map(b =>
      this.api.hap.uuid.generate(PLUGIN_NAME + ':' + b.name + ':' + b.selector)
    );

    for (const accessory of this.accessories) {
      if (!configuredUUIDs.includes(accessory.UUID)) {
        this.log.info(`[1Control] Removing obsolete accessory: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}

module.exports = { OneControlPlatform };
