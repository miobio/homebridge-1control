'use strict';

const puppeteer = require('puppeteer');

const BASE_URL = 'https://web.1control.eu';
const CHROMIUM_PATH = '/usr/bin/chromium-browser';

class OneControlClient {
  constructor(log, username, password) {
    this.log = log;
    this.username = username;
    this.password = password;
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this._browserStarting = false;
  }

  /**
   * Launches the Puppeteer browser if not already running
   */
  async _ensureBrowser() {
    if (this.browser && this.browser.isConnected()) return;

    this.log.info('[1Control] Starting headless browser...');
    this.browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',             // Required on Raspberry Pi
        '--disable-setuid-sandbox', // Required on Raspberry Pi
        '--disable-dev-shm-usage',  // Prevents crashes due to low memory
        '--disable-gpu',            // No GPU needed on Pi
        '--no-first-run',
        '--no-zygote',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 390, height: 844 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    );

    this.log.info('[1Control] Browser started.');
  }

  /**
   * Logs into the 1Control.eu portal using a headless browser
   */
  async login() {
    try {
      await this._ensureBrowser();
      this.log.info('[1Control] Opening login page...');

      await this.page.goto(BASE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for the login form to appear
      await this.page.waitForSelector('input[type="email"], input[type="text"], input[name="email"], input[name="username"]', {
        timeout: 10000,
      });

      this.log.info('[1Control] Login form found. Entering credentials...');

      // Enter email/username
      const emailField = await this.page.$('input[type="email"]') ||
                         await this.page.$('input[name="email"]') ||
                         await this.page.$('input[name="username"]') ||
                         await this.page.$('input[type="text"]');

      await emailField.click({ clickCount: 3 });
      await emailField.type(this.username, { delay: 50 });

      // Enter password
      const passwordField = await this.page.$('input[type="password"]');
      await passwordField.click({ clickCount: 3 });
      await passwordField.type(this.password, { delay: 50 });

      // Click the login button
      const submitBtn = await this.page.$('button[type="submit"], input[type="submit"], button.login-btn, button.accedi');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await passwordField.press('Enter');
      }

      // Wait for post-login redirect
      await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
        .catch(() => this.log.debug('[1Control] No redirect after login, continuing...'));

      // Verify login success: password field should no longer be present
      const stillHasPassword = await this.page.$('input[type="password"]');
      if (stillHasPassword) {
        this.log.error('[1Control] ❌ Login failed. Please check your email and password.');
        this.isLoggedIn = false;
        return false;
      }

      this.isLoggedIn = true;
      this.log.info('[1Control] ✅ Login successful!');
      return true;

    } catch (err) {
      this.log.error('[1Control] Error during login:', err.message);
      this.isLoggedIn = false;
      return false;
    }
  }

  /**
   * Navigates to the device page and clicks the "Activate" button
   * matching the given card label (e.g. "Gate", "Garage", "Barrier")
   *
   * @param {string} cardLabel - Text in the card's <span> element
   * @param {string} pageUrl   - Relative URL of the page (e.g. "/web/it/#/device/13274")
   */
  async clickButton(cardLabel, pageUrl = '/') {
    try {
      // Re-login if session expired
      if (!this.isLoggedIn) {
        const ok = await this.login();
        if (!ok) return false;
      }

      const fullUrl = BASE_URL + pageUrl;
      this.log.info(`[1Control] Navigating to: ${fullUrl}`);

      await this.page.goto(fullUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for Angular to render the dynamic content
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Wait for device cards to be loaded
      await this.page.waitForSelector('.single-action', { timeout: 60000 });

      this.log.info(`[1Control] Looking for card with label: "${cardLabel}"`);

      // Find the index of the card matching the given label
      const cardIndex = await this.page.evaluate((label) => {
        const cards = document.querySelectorAll('.single-action');
        for (let i = 0; i < cards.length; i++) {
          const span = cards[i].querySelector('span.display-block');
          if (span && span.textContent.trim() === label) return i;
        }
        // Debug: log available labels
        const found = Array.from(cards).map(c => {
          const s = c.querySelector('span.display-block');
          return s ? s.textContent.trim() : '(no span)';
        });
        console.error('[1Control] Available cards:', JSON.stringify(found));
        return -1;
      }, cardLabel);

      if (cardIndex === -1) {
        this.log.error(`[1Control] ❌ No card found with label "${cardLabel}".`);
        return false;
      }

      // Click the button using Puppeteer (real click, not JS)
      const buttons = await this.page.$$('#activateButton');
      if (!buttons[cardIndex]) {
        this.log.error(`[1Control] ❌ Button not found at index ${cardIndex}.`);
        return false;
      }

      await buttons[cardIndex].click();
      this.log.info(`[1Control] Button "${cardLabel}" clicked, waiting for confirmation popup...`);

      // Wait for and click the confirmation dialog
      await this.page.waitForSelector('app-confirm-dialog #confirmButton', { timeout: 10000 });
      await this.page.click('app-confirm-dialog #confirmButton');

      this.log.info(`[1Control] ✅ Button "${cardLabel}" confirmed successfully!`);
      return true;

    } catch (err) {
      // Handle expired session
      if (err.message.includes('Session') || err.message.includes('Navigation')) {
        this.log.warn('[1Control] Session expired, re-logging in...');
        this.isLoggedIn = false;
        await this._closeBrowser();
        return await this.clickButton(cardLabel, pageUrl);
      }
      this.log.error('[1Control] Error during button click:', err.message);
      return false;
    }
  }

  /**
   * Closes the browser instance
   */
  async _closeBrowser() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Resets the session
   */
  async logout() {
    this.isLoggedIn = false;
    await this._closeBrowser();
    this.log.info('[1Control] Session reset.');
  }
}

module.exports = { OneControlClient };
