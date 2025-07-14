/**
 * E2E Tests for Video Streaming Platform - Complete Workflow
 * Tests the full streaming lifecycle from setup to playback
 */

const { test, expect } = require('@playwright/test');
const StreamSimulator = require('./utils/stream-simulator');
const BrowserTestUtils = require('./utils/browser-test-utils');

test.describe('Complete Streaming Workflow', () => {
    let streamSimulator;
    let browserUtils;
    
    test.beforeAll(async () => {
        streamSimulator = new StreamSimulator();
        browserUtils = new BrowserTestUtils();
    });
    
    test.afterAll(async () => {
        await streamSimulator.cleanup();
    });
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.connection-status')).toContainText('Connected');
    });
    
    test('should display initial dashboard with no streams', async ({ page }) => {
        // Verify dashboard loads
        await expect(page.locator('h1')).toContainText('Live Streaming Platform');
        
        // Check statistics
        await expect(page.locator('#activeStreams')).toContainText('0');
        await expect(page.locator('#totalSessions')).toContainText('0');
        
        // Verify no streams message
        await expect(page.locator('#streamsContainer')).toContainText('No active streams');
    });
    
    test('should generate and display stream key', async ({ page }) => {
        // Generate stream key
        await page.click('button:has-text("Generate New Key")');
        
        // Verify stream key is generated
        const streamKey = await page.locator('#streamKey').inputValue();
        expect(streamKey).toBeTruthy();
        expect(streamKey.length).toBeGreaterThan(10);
        
        // Verify RTMP URL is displayed
        const rtmpUrl = await page.locator('#rtmpUrl').textContent();
        expect(rtmpUrl).toContain('rtmp://');
        expect(rtmpUrl).toContain(':1935/live');
    });
    
    test('should show stream settings modal', async ({ page }) => {
        // Open streaming info modal
        await page.click('button:has-text("How to Stream")');
        
        // Verify modal is displayed
        await expect(page.locator('.modal-title')).toContainText('Start Streaming');
        
        // Verify streaming instructions
        await expect(page.locator('.modal-body')).toContainText('OBS Studio');
        await expect(page.locator('.modal-body')).toContainText('rtmp://');
        
        // Close modal
        await page.click('.modal .btn-close');
        await expect(page.locator('.modal')).not.toBeVisible();
    });
    
    test('should handle stream start and display in dashboard', async ({ page }) => {
        const streamKey = 'test-stream-001';
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Wait for stream to appear in dashboard
        await browserUtils.waitForStream(page, streamKey);
        
        // Verify stream card appears
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await expect(streamCard).toBeVisible();
        
        // Verify stream status
        await expect(streamCard.locator('.badge')).toContainText('LIVE');
        await expect(streamCard.locator('.status-indicator')).toHaveClass(/status-live/);
        
        // Verify stream actions are available
        await expect(streamCard.locator('button:has-text("Watch")')).toBeVisible();
        await expect(streamCard.locator('button:has-text("VLC")')).toBeVisible();
        await expect(streamCard.locator('button:has-text("Copy URL")')).toBeVisible();
        await expect(streamCard.locator('button:has-text("Stop")')).toBeVisible();
    });
    
    test('should show toast notification for new stream', async ({ page }) => {
        const streamKey = 'test-stream-002';
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Wait for and verify toast notification
        await browserUtils.validateToastNotification(page, 'New stream started!');
        
        // Verify notification disappears after timeout
        await page.waitForTimeout(6000);
        await expect(page.locator('.alert')).not.toBeVisible();
    });
    
    test('should update statistics in real-time', async ({ page }) => {
        const streamKey = 'test-stream-003';
        
        // Get initial stats
        const initialActiveStreams = await page.locator('#activeStreams').textContent();
        const initialTotalSessions = await page.locator('#totalSessions').textContent();
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        
        // Wait for stats to update
        await page.waitForTimeout(2000);
        
        // Verify stats increased
        const newActiveStreams = await page.locator('#activeStreams').textContent();
        const newTotalSessions = await page.locator('#totalSessions').textContent();
        
        expect(parseInt(newActiveStreams)).toBeGreaterThan(parseInt(initialActiveStreams));
        expect(parseInt(newTotalSessions)).toBeGreaterThan(parseInt(initialTotalSessions));
    });
    
    test('should copy stream URL to clipboard', async ({ page, context }) => {
        const streamKey = 'test-stream-004';
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await browserUtils.waitForStream(page, streamKey);
        
        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        
        // Click copy URL button
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Copy URL")').click();
        
        // Verify success toast
        await browserUtils.validateToastNotification(page, 'Stream URL copied to clipboard!');
        
        // Verify clipboard content
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardContent).toContain(`http://localhost:8000/live/${streamKey}.flv`);
    });
    
    test('should initialize video player for stream playback', async ({ page }) => {
        const streamKey = 'test-stream-005';
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await browserUtils.waitForStream(page, streamKey);
        
        // Click watch button
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Verify player section is visible
        await expect(page.locator('#player')).toBeVisible();
        
        // Verify player elements
        await expect(page.locator('#streamPlayer')).toBeVisible();
        await expect(page.locator('.video-js')).toBeVisible();
        
        // Verify stream info is displayed
        await expect(page.locator('#currentStreamPath')).toContainText(streamKey);
        
        // Wait for player to load
        await page.waitForTimeout(5000);
        
        // Verify player status
        const playerStatus = await page.locator('#currentStreamStatus').textContent();
        expect(['Loading...', 'Connecting...', 'Ready', 'Playing']).toContain(playerStatus);
    });
    
    test('should handle stream playback with FLV.js fallback', async ({ page }) => {
        const streamKey = 'test-stream-006';
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await browserUtils.waitForStream(page, streamKey);
        
        // Click watch button
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Wait for player initialization
        await page.waitForTimeout(3000);
        
        // Check for FLV.js fallback activation
        const playerStatus = await page.locator('#currentStreamStatus').textContent();
        
        // Verify player is attempting to play or has fallback
        expect(playerStatus).toMatch(/(Playing|Ready|Playing \(FLV\.js\))/);
        
        // Verify no critical errors
        const errorElements = await page.locator('.alert-danger').count();
        expect(errorElements).toBe(0);
    });
    
    test('should stop stream and update dashboard', async ({ page }) => {
        const streamKey = 'test-stream-007';
        
        // Start test stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await browserUtils.waitForStream(page, streamKey);
        
        // Click stop button
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Stop")').click();
        
        // Verify success toast
        await browserUtils.validateToastNotification(page, 'Stream stopped successfully');
        
        // Wait for stream to disappear from dashboard
        await page.waitForTimeout(3000);
        
        // Verify stream is no longer in dashboard
        await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
        
        // Verify stats updated
        await expect(page.locator('#activeStreams')).toContainText('0');
    });
    
    test('should handle stream end notification', async ({ page }) => {
        const streamKey = 'test-stream-008';
        
        // Start test stream with short duration
        await streamSimulator.startStream(streamKey, { duration: 10 });
        await browserUtils.waitForStream(page, streamKey);
        
        // Wait for stream to end naturally
        await page.waitForTimeout(15000);
        
        // Verify stream ended toast
        await browserUtils.validateToastNotification(page, 'Stream ended');
        
        // Verify stream removed from dashboard
        await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
    });
    
    test('should handle multiple concurrent streams', async ({ page }) => {
        const streamKeys = ['multi-stream-001', 'multi-stream-002', 'multi-stream-003'];
        
        // Start multiple streams
        for (const streamKey of streamKeys) {
            await streamSimulator.startStream(streamKey, { duration: 60 });
        }
        
        // Wait for all streams to appear
        for (const streamKey of streamKeys) {
            await browserUtils.waitForStream(page, streamKey);
        }
        
        // Verify all streams are displayed
        for (const streamKey of streamKeys) {
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).toBeVisible();
        }
        
        // Verify stats reflect multiple streams
        await expect(page.locator('#activeStreams')).toContainText('3');
    });
    
    test('should maintain WebSocket connection during stream operations', async ({ page }) => {
        // Monitor WebSocket connection
        let wsConnected = false;
        let wsDisconnected = false;
        
        page.on('websocket', ws => {
            ws.on('framesent', event => {
                if (event.payload.includes('connect')) {
                    wsConnected = true;
                }
            });
            
            ws.on('close', () => {
                wsDisconnected = true;
            });
        });
        
        // Perform stream operations
        const streamKey = 'test-ws-connection';
        await streamSimulator.startStream(streamKey, { duration: 30 });
        await browserUtils.waitForStream(page, streamKey);
        
        // Verify WebSocket connection is stable
        expect(wsConnected).toBe(true);
        expect(wsDisconnected).toBe(false);
        
        // Verify connection status indicator
        await expect(page.locator('.connection-status')).toContainText('Connected');
    });
});