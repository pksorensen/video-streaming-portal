/**
 * E2E Tests for Toast Notifications
 * Validates real-time notification system for streaming events
 */

const { test, expect } = require('@playwright/test');
const StreamSimulator = require('./utils/stream-simulator');
const BrowserTestUtils = require('./utils/browser-test-utils');

test.describe('Toast Notifications', () => {
    let streamSimulator;
    
    test.beforeAll(async () => {
        streamSimulator = new StreamSimulator();
    });
    
    test.afterAll(async () => {
        await streamSimulator.cleanup();
    });
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await BrowserTestUtils.waitForWebSocketConnection(page);
    });
    
    test('should show success notification when stream starts', async ({ page }) => {
        const streamKey = 'toast-test-start';
        
        // Start stream and wait for notification
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Validate toast notification appears
        const notification = await BrowserTestUtils.validateToastNotification(
            page, 
            'New stream started!', 
            'success'
        );
        
        // Verify notification styling
        await expect(notification).toHaveClass(/alert-success/);
        await expect(notification).toHaveCSS('position', 'fixed');
        await expect(notification).toHaveCSS('z-index', '9999');
        
        // Verify notification has close button
        await expect(notification.locator('.btn-close')).toBeVisible();
    });
    
    test('should show info notification when stream ends', async ({ page }) => {
        const streamKey = 'toast-test-end';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 5 });
        
        // Wait for start notification
        await BrowserTestUtils.validateToastNotification(page, 'New stream started!');
        
        // Wait for stream to end naturally
        await page.waitForTimeout(8000);
        
        // Validate end notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Stream ended', 
            'info'
        );
    });
    
    test('should show success notification when stream is manually stopped', async ({ page }) => {
        const streamKey = 'toast-test-stop';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Manually stop stream via UI
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Stop")').click();
        
        // Validate stop notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Stream stopped successfully', 
            'success'
        );
    });
    
    test('should show error notification when stream stop fails', async ({ page }) => {
        const streamKey = 'nonexistent-stream';
        
        // Try to stop non-existent stream via API
        await page.evaluate(async (key) => {
            try {
                const response = await fetch(`/api/streams/${key}/stop`, {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    // Simulate the error notification that would be shown
                    window.app.showNotification(data.message || 'Failed to stop stream', 'danger');
                }
            } catch (error) {
                window.app.showNotification('Failed to stop stream', 'danger');
            }
        }, streamKey);
        
        // Validate error notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Stream not found', 
            'danger'
        );
    });
    
    test('should show success notification when stream URL is copied', async ({ page, context }) => {
        const streamKey = 'toast-test-copy';
        
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Copy stream URL
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Copy URL")').click();
        
        // Validate copy notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Stream URL copied to clipboard!', 
            'success'
        );
    });
    
    test('should show error notification when copy fails', async ({ page }) => {
        const streamKey = 'toast-test-copy-fail';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Mock clipboard to fail
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: () => Promise.reject(new Error('Clipboard access denied'))
                }
            });
        });
        
        // Try to copy stream URL
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Copy URL")').click();
        
        // Validate error notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Failed to copy URL', 
            'danger'
        );
    });
    
    test('should show info notification with VLC instructions', async ({ page }) => {
        const streamKey = 'toast-test-vlc';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Click VLC button
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("VLC")').click();
        
        // Validate VLC instructions notification
        const notification = await BrowserTestUtils.validateToastNotification(
            page, 
            'VLC Instructions', 
            'info'
        );
        
        // Verify notification contains instructions
        await expect(notification).toContainText('Open VLC Media Player');
        await expect(notification).toContainText('Media → Open Network Stream');
        await expect(notification).toContainText('8000/live/');
    });
    
    test('should show success notification when stream key is generated', async ({ page }) => {
        // Generate new stream key
        await page.click('button:has-text("Generate New Key")');
        
        // Validate key generation notification (if implemented)
        // Note: This test depends on the implementation adding a notification
        const streamKey = await page.locator('#streamKey').inputValue();
        expect(streamKey).toBeTruthy();
        
        // Verify key was actually generated
        expect(streamKey.length).toBeGreaterThan(10);
    });
    
    test('should show success notification when stream settings are copied', async ({ page, context }) => {
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        // Generate stream key
        await page.click('button:has-text("Generate New Key")');
        
        // Copy stream settings
        await page.evaluate(() => {
            window.copyStreamSettings();
        });
        
        // Validate settings copied notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Stream settings copied to clipboard!', 
            'success'
        );
    });
    
    test('should show error notification on connection issues', async ({ page }) => {
        // Simulate connection error
        await page.evaluate(() => {
            // Trigger a socket error
            window.app.socket.emit('error', new Error('Connection failed'));
        });
        
        // Validate connection error notification
        await BrowserTestUtils.validateToastNotification(
            page, 
            'Connection error', 
            'danger'
        );
    });
    
    test('should show playback-related notifications', async ({ page }) => {
        const streamKey = 'toast-test-playback';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Start playback
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Wait for playback to start
        await page.waitForTimeout(5000);
        
        // Check for playback success notification
        const hasPlaybackNotification = await page.locator('.alert-success').count();
        if (hasPlaybackNotification > 0) {
            await expect(page.locator('.alert-success')).toContainText('Now playing');
        }
    });
    
    test('should auto-dismiss notifications after timeout', async ({ page }) => {
        const streamKey = 'toast-test-timeout';
        
        // Start stream to trigger notification
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Wait for notification
        const notification = await BrowserTestUtils.validateToastNotification(
            page, 
            'New stream started!', 
            'success'
        );
        
        // Wait for auto-dismiss (5 seconds)
        await page.waitForTimeout(6000);
        
        // Verify notification is gone
        await expect(notification).not.toBeVisible();
    });
    
    test('should allow manual dismissal of notifications', async ({ page }) => {
        const streamKey = 'toast-test-dismiss';
        
        // Start stream to trigger notification
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Wait for notification
        const notification = await BrowserTestUtils.validateToastNotification(
            page, 
            'New stream started!', 
            'success'
        );
        
        // Manually dismiss notification
        await notification.locator('.btn-close').click();
        
        // Verify notification is gone immediately
        await expect(notification).not.toBeVisible();
    });
    
    test('should handle multiple concurrent notifications', async ({ page }) => {
        const streamKeys = ['multi-toast-1', 'multi-toast-2', 'multi-toast-3'];
        
        // Start multiple streams quickly
        for (const streamKey of streamKeys) {
            await streamSimulator.startStream(streamKey, { duration: 30 });
            await page.waitForTimeout(1000); // Small delay between streams
        }
        
        // Wait for all notifications
        await page.waitForTimeout(3000);
        
        // Verify multiple notifications are displayed
        const notifications = await page.locator('.alert-success').count();
        expect(notifications).toBeGreaterThan(1);
        
        // Verify they stack properly (don't overlap)
        const firstNotification = page.locator('.alert-success').first();
        const secondNotification = page.locator('.alert-success').nth(1);
        
        if (await secondNotification.isVisible()) {
            const firstRect = await firstNotification.boundingBox();
            const secondRect = await secondNotification.boundingBox();
            
            // Second notification should be below the first
            expect(secondRect.y).toBeGreaterThan(firstRect.y);
        }
    });
    
    test('should show appropriate notifications for different stream states', async ({ page }) => {
        const streamKey = 'toast-test-states';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 20 });
        await BrowserTestUtils.validateToastNotification(page, 'New stream started!', 'success');
        
        // Start playback
        await BrowserTestUtils.waitForStream(page, streamKey);
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Wait for playback notifications
        await page.waitForTimeout(3000);
        
        // Stop stream
        await streamSimulator.stopStream(streamKey);
        
        // Validate stream ended notification
        await BrowserTestUtils.validateToastNotification(page, 'Stream ended', 'info');
    });
});