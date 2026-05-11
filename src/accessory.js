'use strict';

/**
 * HomeKit Accessory for a single 1Control button
 * Appears as a "Switch" in HomeKit
 * When activated, it clicks the button on the website, then resets automatically
 */
class OneControlAccessory {
  constructor(platform, accessory, buttonConfig, client) {
    this.platform = platform;
    this.accessory = accessory;
    this.config = buttonConfig;
    this.client = client;
    this.log = platform.log;
    this.hap = platform.api.hap;

    // Internal switch state
    this.isOn = false;

    // Set device information
    this.accessory.getService(this.hap.Service.AccessoryInformation)
      .setCharacteristic(this.hap.Characteristic.Manufacturer, '1Control')
      .setCharacteristic(this.hap.Characteristic.Model, 'Web Button')
      .setCharacteristic(this.hap.Characteristic.SerialNumber, buttonConfig.selector);

    // Get or create the Switch service
    this.service = this.accessory.getService(this.hap.Service.Switch)
      || this.accessory.addService(this.hap.Service.Switch);

    // Set the accessory name in the Home app
    this.service.setCharacteristic(
      this.hap.Characteristic.Name,
      buttonConfig.name
    );

    // Register handlers for HomeKit get/set events
    this.service.getCharacteristic(this.hap.Characteristic.On)
      .onGet(this.handleGet.bind(this))
      .onSet(this.handleSet.bind(this));

    this.log.info(`[1Control] Accessory ready: "${buttonConfig.name}" → card label: "${buttonConfig.selector}"`);
  }

  /**
   * HomeKit asks: is the switch on or off?
   */
  async handleGet() {
    return this.isOn;
  }

  /**
   * HomeKit wants to turn the switch on or off
   * @param {boolean} value - true = on, false = off
   */
  async handleSet(value) {
    if (value) {
      this.log.info(`[1Control] 🟢 "${this.config.name}" activated - executing click...`);
      this.isOn = true;

      try {
        const pageUrl = this.config.pageUrl || '/';
        const success = await this.client.clickButton(this.config.selector, pageUrl);

        if (success) {
          this.log.info(`[1Control] ✅ "${this.config.name}" - click executed successfully!`);
        } else {
          this.log.error(`[1Control] ❌ "${this.config.name}" - click failed.`);
        }
      } catch (err) {
        this.log.error(`[1Control] Error for "${this.config.name}":`, err.message);
      }

      // Automatically reset the switch after the configured delay
      // (typical behavior for a gate/momentary button)
      const resetDelay = this.config.resetDelay !== undefined ? this.config.resetDelay : 1500;

      if (resetDelay >= 0) {
        setTimeout(() => {
          this.isOn = false;
          this.service.updateCharacteristic(this.hap.Characteristic.On, false);
          this.log.debug(`[1Control] "${this.config.name}" - switch reset to OFF`);
        }, resetDelay);
      }

    } else {
      // User manually turned off the switch
      this.isOn = false;
      this.log.debug(`[1Control] "${this.config.name}" manually turned off.`);
    }
  }
}

module.exports = { OneControlAccessory };
