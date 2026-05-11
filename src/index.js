'use strict';

const { OneControlPlatform } = require('./platform');

const PLUGIN_NAME = 'homebridge-1control';
const PLATFORM_NAME = '1ControlPlatform';

/**
 * This method is called by Homebridge when the plugin is loaded.
 * It registers the platform with Homebridge.
 */
module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, OneControlPlatform);
};
