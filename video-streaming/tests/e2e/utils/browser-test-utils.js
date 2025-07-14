/**
 * Browser Test Utilities for E2E Testing
 * Helper functions for common browser-based test operations
 */

const { expect } = require('@playwright/test');

class BrowserTestUtils {
    /**
     * Wait for a stream to appear in the dashboard
     * @param {Page} page - Playwright page object
     * @param {string} streamKey - Stream identifier to wait for
     * @param {number} timeout - Timeout in milliseconds
     */
    static async waitForStream(page, streamKey, timeout = 30000) {
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        
        await expect(streamCard).toBeVisible({ timeout });
        await expect(streamCard.locator('.badge')).toContainText('LIVE');
        
        console.log(`✅ Stream ${streamKey} appeared in dashboard`);
    }
    
    /**
     * Validate that a toast notification appears with specific message
     * @param {Page} page - Playwright page object
     * @param {string} message - Expected notification message
     * @param {string} type - Notification type (success, info, danger, warning)
     * @param {number} timeout - Timeout in milliseconds
     */
    static async validateToastNotification(page, message, type = 'success', timeout = 10000) {
        const notification = page.locator(`.alert-${type}:has-text("${message}")`);
        
        await expect(notification).toBeVisible({ timeout });
        console.log(`✅ Toast notification validated: ${message}`);
        
        return notification;
    }
    
    /**
     * Check video player status and controls
     * @param {Page} page - Playwright page object
     * @param {string} expectedStatus - Expected player status
     */
    static async checkPlayerStatus(page, expectedStatus = null) {
        const player = page.locator('#streamPlayer');
        const playerStatus = page.locator('#currentStreamStatus');
        
        // Verify player is visible
        await expect(player).toBeVisible();
        await expect(page.locator('.video-js')).toBeVisible();
        
        // Check player status if specified
        if (expectedStatus) {
            await expect(playerStatus).toContainText(expectedStatus);
        }
        
        // Verify player controls are available
        await expect(player.locator('.vjs-play-control')).toBeVisible();
        await expect(player.locator('.vjs-volume-control')).toBeVisible();
        await expect(player.locator('.vjs-fullscreen-control')).toBeVisible();
        
        console.log('✅ Player status and controls validated');
    }
    
    /**
     * Wait for WebSocket connection to be established
     * @param {Page} page - Playwright page object
     * @param {number} timeout - Timeout in milliseconds
     */
    static async waitForWebSocketConnection(page, timeout = 10000) {
        const connectionStatus = page.locator('.connection-status');
        
        await expect(connectionStatus).toContainText('Connected', { timeout });
        console.log('✅ WebSocket connection established');
    }
    
    /**
     * Validate stream statistics display
     * @param {Page} page - Playwright page object
     * @param {object} expectedStats - Expected statistics values
     */
    static async validateStreamStats(page, expectedStats = {}) {
        const statsElements = {
            activeStreams: page.locator('#activeStreams'),
            totalSessions: page.locator('#totalSessions'),
            serverUptime: page.locator('#serverUptime')
        };
        
        // Verify stats elements are visible
        for (const [key, element] of Object.entries(statsElements)) {
            await expect(element).toBeVisible();
            
            if (expectedStats[key] !== undefined) {
                await expect(element).toContainText(expectedStats[key].toString());
            }
        }
        
        console.log('✅ Stream statistics validated');
    }
    
    /**
     * Test clipboard functionality
     * @param {Page} page - Playwright page object
     * @param {BrowserContext} context - Browser context for permissions
     * @param {string} expectedContent - Expected clipboard content
     */
    static async testClipboard(page, context, expectedContent) {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        // Wait for clipboard to be updated
        await page.waitForTimeout(1000);
        
        // Read clipboard content
        const clipboardContent = await page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        
        expect(clipboardContent).toContain(expectedContent);
        console.log('✅ Clipboard content validated');
    }
    
    /**
     * Simulate network conditions
     * @param {Page} page - Playwright page object
     * @param {object} conditions - Network condition parameters
     */
    static async simulateNetworkConditions(page, conditions = {}) {
        const {
            offline = false,
            downloadThroughput = 1000000, // 1MB/s
            uploadThroughput = 500000,     // 500KB/s
            latency = 100                  // 100ms
        } = conditions;
        
        const client = await page.context().newCDPSession(page);
        
        if (offline) {
            await client.send('Network.emulateNetworkConditions', {
                offline: true,
                downloadThroughput: 0,
                uploadThroughput: 0,
                latency: 0
            });
            console.log('📶 Network set to offline mode');
        } else {
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput,
                uploadThroughput,
                latency
            });
            console.log(`📶 Network conditions simulated: ${downloadThroughput/1000}KB/s down, ${uploadThroughput/1000}KB/s up, ${latency}ms latency`);
        }
    }
    
    /**
     * Monitor browser console errors
     * @param {Page} page - Playwright page object
     * @param {Array} allowedErrors - Array of allowed error patterns
     */
    static async monitorConsoleErrors(page, allowedErrors = []) {
        const errors = [];
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const error = msg.text();
                
                // Check if error is in allowed list
                const isAllowed = allowedErrors.some(pattern => 
                    error.includes(pattern) || error.match(pattern)
                );
                
                if (!isAllowed) {
                    errors.push(error);
                    console.error('❌ Console error:', error);
                }
            }
        });
        
        return errors;
    }
    
    /**
     * Wait for element to contain specific text
     * @param {Page} page - Playwright page object
     * @param {string} selector - Element selector
     * @param {string} text - Expected text
     * @param {number} timeout - Timeout in milliseconds
     */
    static async waitForElementText(page, selector, text, timeout = 10000) {
        const element = page.locator(selector);
        await expect(element).toContainText(text, { timeout });
        console.log(`✅ Element ${selector} contains text: ${text}`);
    }
    
    /**
     * Verify responsive design at different viewport sizes
     * @param {Page} page - Playwright page object
     * @param {Array} viewports - Array of viewport sizes to test
     */
    static async testResponsiveDesign(page, viewports = []) {
        const defaultViewports = [
            { width: 1920, height: 1080, name: 'Desktop' },
            { width: 1024, height: 768, name: 'Tablet' },
            { width: 375, height: 667, name: 'Mobile' }
        ];
        
        const testViewports = viewports.length > 0 ? viewports : defaultViewports;
        
        for (const viewport of testViewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.waitForTimeout(1000);
            
            // Verify key elements are still visible
            await expect(page.locator('h1')).toBeVisible();
            await expect(page.locator('#streamsContainer')).toBeVisible();
            
            console.log(`✅ Responsive design verified for ${viewport.name} (${viewport.width}x${viewport.height})`);
        }
    }
    
    /**
     * Take screenshot with timestamp
     * @param {Page} page - Playwright page object
     * @param {string} name - Screenshot name
     * @param {object} options - Screenshot options
     */
    static async takeTimestampedScreenshot(page, name, options = {}) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${name}-${timestamp}.png`;
        
        await page.screenshot({
            path: `test-results/screenshots/${filename}`,
            fullPage: true,
            ...options
        });
        
        console.log(`📸 Screenshot taken: ${filename}`);
    }
    
    /**
     * Wait for API response
     * @param {Page} page - Playwright page object
     * @param {string} endpoint - API endpoint to wait for
     * @param {number} timeout - Timeout in milliseconds
     */
    static async waitForApiResponse(page, endpoint, timeout = 10000) {
        const response = await page.waitForResponse(
            response => response.url().includes(endpoint) && response.status() === 200,
            { timeout }
        );
        
        console.log(`✅ API response received for ${endpoint}`);
        return response;
    }
    
    /**
     * Validate video player initialization
     * @param {Page} page - Playwright page object
     */
    static async validateVideoPlayerInit(page) {
        // Check for Video.js initialization
        await expect(page.locator('.video-js')).toBeVisible();
        await expect(page.locator('.vjs-tech')).toBeVisible();
        
        // Check for FLV.js availability
        const flvjsAvailable = await page.evaluate(() => {
            return typeof window.flvjs !== 'undefined';
        });
        
        expect(flvjsAvailable).toBe(true);
        
        // Check for plugin registration
        const pluginRegistered = await page.evaluate(() => {
            return window.videojs && window.videojs.getPlugin && window.videojs.getPlugin('flvjs');
        });
        
        expect(pluginRegistered).toBeTruthy();
        
        console.log('✅ Video player initialization validated');
    }
    
    /**
     * Test keyboard shortcuts
     * @param {Page} page - Playwright page object
     * @param {object} shortcuts - Keyboard shortcuts to test
     */
    static async testKeyboardShortcuts(page, shortcuts = {}) {
        const defaultShortcuts = {
            'Space': 'play/pause',
            'f': 'fullscreen',
            'm': 'mute',
            'ArrowUp': 'volume up',
            'ArrowDown': 'volume down'
        };
        
        const testShortcuts = Object.keys(shortcuts).length > 0 ? shortcuts : defaultShortcuts;
        
        // Focus on video player
        await page.locator('#streamPlayer').focus();
        
        for (const [key, action] of Object.entries(testShortcuts)) {
            await page.keyboard.press(key);
            await page.waitForTimeout(500);
            
            console.log(`✅ Keyboard shortcut tested: ${key} (${action})`);
        }
    }
}

module.exports = BrowserTestUtils;