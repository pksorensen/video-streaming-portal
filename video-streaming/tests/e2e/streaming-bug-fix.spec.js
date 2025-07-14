/**
 * E2E Tests for Streaming Bug Fix Validation
 * Specifically tests the fixes for session management and dashboard updates
 */

const { test, expect } = require('@playwright/test');
const StreamSimulator = require('./utils/stream-simulator');
const BrowserTestUtils = require('./utils/browser-test-utils');

test.describe('Streaming Bug Fix Validation', () => {
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
    
    test('should correctly track session state transitions', async ({ page }) => {
        const streamKey = 'session-state-test';
        
        // Verify initial state (no sessions)
        await expect(page.locator('#totalSessions')).toContainText('0');
        await expect(page.locator('#activeStreams')).toContainText('0');
        
        // Start stream and verify session tracking
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Wait for session to be tracked
        await page.waitForTimeout(3000);
        
        // Verify session count increased
        await expect(page.locator('#totalSessions')).not.toContainText('0');
        await expect(page.locator('#activeStreams')).toContainText('1');
        
        // Verify stream appears in dashboard
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Stop stream and verify session cleanup
        await streamSimulator.stopStream(streamKey);
        
        // Wait for session cleanup
        await page.waitForTimeout(3000);
        
        // Verify active streams decreased
        await expect(page.locator('#activeStreams')).toContainText('0');
        
        // Verify stream removed from dashboard
        await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
    });
    
    test('should handle rapid session state changes', async ({ page }) => {
        const streamKey = 'rapid-session-test';
        
        // Rapidly start and stop stream multiple times
        for (let i = 0; i < 3; i++) {
            console.log(`🔄 Rapid session test iteration ${i + 1}`);
            
            // Start stream
            await streamSimulator.startStream(streamKey, { duration: 10 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Verify session tracking
            await expect(page.locator('#activeStreams')).toContainText('1');
            
            // Stop stream
            await streamSimulator.stopStream(streamKey);
            
            // Wait for cleanup
            await page.waitForTimeout(2000);
            
            // Verify session cleanup
            await expect(page.locator('#activeStreams')).toContainText('0');
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
        }
    });
    
    test('should properly handle session metadata', async ({ page }) => {
        const streamKey = 'metadata-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Verify stream metadata is displayed
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        
        // Check for LIVE badge
        await expect(streamCard.locator('.badge')).toContainText('LIVE');
        
        // Check for status indicator
        await expect(streamCard.locator('.status-indicator')).toHaveClass(/status-live/);
        
        // Check for duration display
        await expect(streamCard.locator('.card-text')).toContainText('Duration:');
        
        // Check for URL display
        await expect(streamCard.locator('.card-text')).toContainText('8000/live/');
        
        // Verify stream actions are available
        await expect(streamCard.locator('button:has-text("Watch")')).toBeVisible();
        await expect(streamCard.locator('button:has-text("Stop")')).toBeVisible();
    });
    
    test('should handle WebSocket reconnection properly', async ({ page }) => {
        const streamKey = 'websocket-reconnect-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Simulate WebSocket disconnection
        await page.evaluate(() => {
            if (window.app && window.app.socket) {
                window.app.socket.disconnect();
            }
        });
        
        // Wait for disconnection
        await page.waitForTimeout(1000);
        
        // Verify connection status shows disconnected
        await expect(page.locator('.connection-status')).toContainText('Disconnected');
        
        // Simulate reconnection
        await page.evaluate(() => {
            if (window.app && window.app.socket) {
                window.app.socket.connect();
            }
        });
        
        // Wait for reconnection
        await page.waitForTimeout(3000);
        
        // Verify connection status shows connected
        await expect(page.locator('.connection-status')).toContainText('Connected');
        
        // Verify stream is still displayed after reconnection
        await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).toBeVisible();
    });
    
    test('should handle concurrent session operations', async ({ page }) => {
        const streamKeys = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
        
        // Start multiple streams concurrently
        const startPromises = streamKeys.map(key => 
            streamSimulator.startStream(key, { duration: 30 })
        );
        
        await Promise.all(startPromises);
        
        // Verify all streams are tracked
        await page.waitForTimeout(5000);
        
        for (const streamKey of streamKeys) {
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).toBeVisible();
        }
        
        // Verify session count
        await expect(page.locator('#activeStreams')).toContainText('3');
        
        // Stop all streams concurrently
        const stopPromises = streamKeys.map(key => 
            streamSimulator.stopStream(key)
        );
        
        await Promise.all(stopPromises);
        
        // Wait for cleanup
        await page.waitForTimeout(3000);
        
        // Verify all streams are removed
        for (const streamKey of streamKeys) {
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
        }
        
        // Verify session count reset
        await expect(page.locator('#activeStreams')).toContainText('0');
    });
    
    test('should handle session cleanup on page refresh', async ({ page }) => {
        const streamKey = 'refresh-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Refresh page
        await page.reload();
        
        // Wait for page to load
        await BrowserTestUtils.waitForWebSocketConnection(page);
        await page.waitForTimeout(3000);
        
        // Verify stream is still displayed (if backend maintained session)
        // OR verify proper cleanup occurred
        const streamExists = await page.locator(`.stream-card:has-text("${streamKey}")`).isVisible();
        
        if (streamExists) {
            // Stream should still be marked as live
            await expect(page.locator(`.stream-card:has-text("${streamKey}") .badge`)).toContainText('LIVE');
        } else {
            // If stream not visible, verify session count is consistent
            const activeStreams = await page.locator('#activeStreams').textContent();
            expect(activeStreams).toBe('0');
        }
    });
    
    test('should properly handle stream publishing state', async ({ page }) => {
        const streamKey = 'publishing-state-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Verify stream is marked as publishing
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await expect(streamCard.locator('.badge')).toContainText('LIVE');
        await expect(streamCard.locator('.status-indicator')).toHaveClass(/status-live/);
        
        // Verify statistics reflect publishing state
        await expect(page.locator('#activeStreams')).toContainText('1');
        
        // Stop stream
        await streamSimulator.stopStream(streamKey);
        
        // Wait for state update
        await page.waitForTimeout(3000);
        
        // Verify stream is no longer publishing
        await expect(streamCard).not.toBeVisible();
        await expect(page.locator('#activeStreams')).toContainText('0');
    });
    
    test('should handle stream path extraction correctly', async ({ page }) => {
        const streamKey = 'path-extraction-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Verify stream key is correctly extracted and displayed
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await expect(streamCard.locator('.card-title')).toContainText(`Stream: ${streamKey}`);
        
        // Verify stream URL is correctly formatted
        await expect(streamCard.locator('.card-text')).toContainText(`8000/live/${streamKey}.flv`);
        
        // Test copy URL functionality
        await streamCard.locator('button:has-text("Copy URL")').click();
        
        // Verify success notification
        await BrowserTestUtils.validateToastNotification(page, 'Stream URL copied to clipboard!');
    });
    
    test('should handle API error responses gracefully', async ({ page }) => {
        const nonExistentStreamKey = 'nonexistent-stream';
        
        // Try to stop non-existent stream
        await page.evaluate(async (streamKey) => {
            try {
                const response = await fetch(`/api/streams/${streamKey}/stop`, {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (!data.success) {
                    window.app.showNotification(data.message || 'Failed to stop stream', 'danger');
                }
            } catch (error) {
                window.app.showNotification('Network error', 'danger');
            }
        }, nonExistentStreamKey);
        
        // Verify error notification
        await BrowserTestUtils.validateToastNotification(page, 'Stream not found', 'danger');
    });
    
    test('should handle stream duration tracking accurately', async ({ page }) => {
        const streamKey = 'duration-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Wait for duration to update
        await page.waitForTimeout(5000);
        
        // Check duration display
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        const durationText = await streamCard.locator('.card-text').textContent();
        
        // Duration should show some elapsed time
        expect(durationText).toMatch(/Duration: 0:0[0-9]/);
        
        // Wait longer and verify duration updates
        await page.waitForTimeout(10000);
        
        const updatedDurationText = await streamCard.locator('.card-text').textContent();
        expect(updatedDurationText).toMatch(/Duration: 0:[0-9][0-9]/);
    });
    
    test('should handle FLV.js fallback mechanism', async ({ page }) => {
        const streamKey = 'flv-fallback-test';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Start playback
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Wait for player to initialize
        await page.waitForTimeout(5000);
        
        // Check if FLV.js fallback is working
        const playerStatus = await page.locator('#currentStreamStatus').textContent();
        
        // Should show either normal playback or FLV.js fallback
        expect(['Playing', 'Playing (FLV.js)', 'Ready', 'Connecting...']).toContain(playerStatus);
        
        // Verify no critical errors
        const errorNotifications = await page.locator('.alert-danger').count();
        expect(errorNotifications).toBe(0);
    });
    
    test('should handle stream statistics updates correctly', async ({ page }) => {
        const streamKey = 'stats-update-test';
        
        // Get initial statistics
        const initialStats = await page.evaluate(() => ({
            activeStreams: document.getElementById('activeStreams').textContent,
            totalSessions: document.getElementById('totalSessions').textContent
        }));
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Wait for statistics to update
        await page.waitForTimeout(3000);
        
        // Verify statistics increased
        const updatedStats = await page.evaluate(() => ({
            activeStreams: document.getElementById('activeStreams').textContent,
            totalSessions: document.getElementById('totalSessions').textContent
        }));
        
        expect(parseInt(updatedStats.activeStreams)).toBeGreaterThan(parseInt(initialStats.activeStreams));
        expect(parseInt(updatedStats.totalSessions)).toBeGreaterThan(parseInt(initialStats.totalSessions));
        
        // Stop stream
        await streamSimulator.stopStream(streamKey);
        
        // Wait for statistics to update
        await page.waitForTimeout(3000);
        
        // Verify active streams decreased
        const finalStats = await page.evaluate(() => ({
            activeStreams: document.getElementById('activeStreams').textContent,
            totalSessions: document.getElementById('totalSessions').textContent
        }));
        
        expect(parseInt(finalStats.activeStreams)).toBeLessThan(parseInt(updatedStats.activeStreams));
    });
});