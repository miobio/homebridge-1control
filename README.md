# homebridge-1control

A Homebridge plugin to control devices via the **[web.1control.eu](https://web.1control.eu)** web portal.

This plugin automatically logs in and simulates button clicks on the 1Control web interface, making your 1Control devices controllable via **Apple HomeKit** and **Siri**.

---

## How it works

The Plug-In will create a switch. Every switch activation will trigger an "open" signal, pretty much like pushing your gate remote button. If you want to replicate a gate object on HomeKit I suggest you to use a dummy gate Plug-In and replicate its behaviour via HomeKit Automation. This is particularly useful for Siri otherwise the switch object is not perceived by Siri as a Gate...

When you activate the switch in HomeKit (or via Siri), the plugin:

1. Opens a headless browser session with `web.1control.eu`
2. Logs in with your credentials
3. Navigates to the configured page
4. Finds the correct device card by its label and clicks the activate button
5. Confirms the action on the confirmation dialog
6. The switch automatically resets to OFF after a few seconds (like a momentary button)

---

## Requirements

- [Homebridge](https://homebridge.io) >= 1.3.0
- Node.js >= 14.0.0
- Chromium browser installed on the host system

### Install Chromium (Raspberry Pi)

```bash
sudo apt-get install chromium-browser -y
```

---

## Installation

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm install -g homebridge-1control
```

> **Important:** Always use `PUPPETEER_SKIP_DOWNLOAD=true` to avoid downloading a bundled Chromium (~300MB). The plugin uses the system-installed Chromium instead.

Or install via the **Homebridge UI** by searching for `homebridge-1control`.

---

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "1ControlPlatform",
      "name": "1Control",
      "username": "your@email.com",
      "password": "yourpassword",
      "buttons": [
        {
          "name": "1Control accessory description here",
          "selector": "Selector name e.g. Gate",
          "pageUrl": "/web/it/#/device/XXXXX",
          "resetDelay": 1500
        },
        {
          "name": "1Control accessory description here",
          "selector": "Garage",
          "pageUrl": "/web/it/#/device/XXXXX",
          "resetDelay": 1500
        },
        {
          "name": "1Control accessory description here",
          "selector": "Barrier",
          "pageUrl": "/web/it/#/device/XXXXX",
          "resetDelay": 1500
        }
      ]
    }
  ]
}
```

### Configuration options

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `username` | string | ✅ | Your 1Control login email/username |
| `password` | string | ✅ | Your 1Control login password |
| `buttons` | array | ✅ | List of 1Control gates, barriers, garage doors etc. to expose to HomeKit |
| `buttons[].name` | string | ✅ | Name shown in the Home app (e.g. "Main Gate") |
| `buttons[].selector` | string | ✅ | Exact text of the device card label on the web.1control.eu website |
| `buttons[].pageUrl` | string | ❌ | Relative URL of the device page (default: `/`) |
| `buttons[].resetDelay` | number | ❌ | Ms before switch resets to OFF (default: `1500`, `-1` = never) |

---

## How to find the card label (selector)

1. Open **web.1control.eu** in your browser and log in or register
2. Add your device(s) following the online procedure
3. Navigate to the device page
4. Look at the label shown below each device icon — that is your `selector` value
5. <Optional> For extra safety, Right-click → **Inspect** to confirm the text inside the `<span class="display-block">` element

Example HTML:
```html
<div class="single-action">
  <span class="display-block">Gate</span>
  <a id="activateButton" class="button">Activate</a>
</div>
```

In this case, use `"selector": "Gate"`.

---

## Performance notes

- **First activation** takes ~30-60 seconds on a Raspberry Pi 3 (browser cold start + login)
- **Subsequent activations** are much faster (~5-10 seconds) since the browser and session stay active in memory
- Tested on **Raspberry Pi 3 Model B** with Chromium 126

---

## Debugging

To see detailed logs, start Homebridge in debug mode:

```bash
homebridge -D
```

All plugin log entries are prefixed with `[1Control]` for easy filtering.

If a button is not found, the plugin will log all available card labels to help you identify the correct `selector` value.

---

## Project structure

```
homebridge-1control/
├── src/
│   ├── index.js      # Entry point - registers the platform
│   ├── platform.js   # Homebridge platform - manages accessories
│   ├── accessory.js  # HomeKit Switch accessory
│   └── client.js     # HTTP/browser client for web.1control.eu
├── config.schema.json  # Schema for Homebridge UI
├── package.json
└── README.md
```

---

## License

MIT
