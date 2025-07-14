/**
 * Performance Tests for Video Streaming Platform
 * Tests system performance under various load conditions
 */

const { test, expect } = require('@playwright/test');
const StreamSimulator = require('./utils/stream-simulator');
const BrowserTestUtils = require('./utils/browser-test-utils');

test.describe('Performance Tests', () => {
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
    
    test('should handle multiple concurrent streams efficiently', async ({ page }) => {
        const streamKeys = Array.from({ length: 5 }, (_, i) => `perf-stream-${i + 1}`);
        const startTime = Date.now();
        
        // Start multiple streams concurrently
        const streamPromises = streamKeys.map(key => 
            streamSimulator.startStream(key, { duration: 60 })
        );
        
        await Promise.all(streamPromises);
        
        // Measure time to start all streams
        const streamStartTime = Date.now() - startTime;
        console.log(`📊 Time to start ${streamKeys.length} streams: ${streamStartTime}ms`);
        
        // Verify all streams appear in dashboard
        for (const streamKey of streamKeys) {
            await BrowserTestUtils.waitForStream(page, streamKey);
        }
        
        // Measure dashboard update time
        const dashboardUpdateTime = Date.now() - startTime;
        console.log(`📊 Time to update dashboard: ${dashboardUpdateTime}ms`);
        
        // Verify performance metrics
        expect(streamStartTime).toBeLessThan(15000); // Should start within 15 seconds
        expect(dashboardUpdateTime).toBeLessThan(20000); // Dashboard should update within 20 seconds
        
        // Verify statistics are correct
        await BrowserTestUtils.validateStreamStats(page, {
            activeStreams: streamKeys.length
        });
    });
    
    test('should maintain responsiveness during high stream load', async ({ page }) => {
        const streamKeys = Array.from({ length: 10 }, (_, i) => `load-stream-${i + 1}`);
        
        // Start streams gradually
        for (const streamKey of streamKeys) {
            await streamSimulator.startStream(streamKey, { duration: 30 });
            await page.waitForTimeout(500); // Small delay between streams
        }
        
        // Measure page responsiveness
        const startTime = Date.now();
        await page.click('button:has-text("Generate New Key")');
        const responseTime = Date.now() - startTime;
        
        console.log(`📊 UI response time under load: ${responseTime}ms`);
        expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
        
        // Verify all streams are still displayed
        for (const streamKey of streamKeys) {
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).toBeVisible();
        }
    });
    
    test('should handle rapid stream start/stop cycles', async ({ page }) => {
        const streamKey = 'rapid-cycle-stream';
        const cycles = 5;
        
        for (let i = 0; i < cycles; i++) {
            const startTime = Date.now();
            
            // Start stream
            await streamSimulator.startStream(streamKey, { duration: 10 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Stop stream
            await streamSimulator.stopStream(streamKey);
            
            // Wait for stream to disappear
            await page.waitForTimeout(2000);
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
            
            const cycleTime = Date.now() - startTime;
            console.log(`📊 Cycle ${i + 1} time: ${cycleTime}ms`);
            
            expect(cycleTime).toBeLessThan(10000); // Each cycle should complete within 10 seconds
        }
    });
    
    test('should handle memory usage efficiently', async ({ page }) => {
        const initialMemory = await page.evaluate(() => {
            return performance.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize
            } : null;
        });
        
        // Skip test if memory API not available
        if (!initialMemory) {
            test.skip('Memory API not available in this browser');
            return;
        }
        
        const streamKeys = Array.from({ length: 3 }, (_, i) => `memory-stream-${i + 1}`);
        
        // Start streams
        for (const streamKey of streamKeys) {
            await streamSimulator.startStream(streamKey, { duration: 30 });
            await BrowserTestUtils.waitForStream(page, streamKey);
        }
        
        // Measure memory after streams
        const memoryAfterStreams = await page.evaluate(() => {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize
            };
        });
        
        // Stop all streams
        for (const streamKey of streamKeys) {
            await streamSimulator.stopStream(streamKey);
        }
        
        // Wait for cleanup
        await page.waitForTimeout(5000);
        
        // Force garbage collection if available
        await page.evaluate(() => {
            if (window.gc) {
                window.gc();
            }
        });
        
        // Measure memory after cleanup
        const memoryAfterCleanup = await page.evaluate(() => {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize
            };
        });
        
        console.log('📊 Memory usage:');
        console.log(`  Initial: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  After streams: ${(memoryAfterStreams.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  After cleanup: ${(memoryAfterCleanup.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
        
        // Memory should not increase by more than 50MB
        const memoryIncrease = memoryAfterCleanup.usedJSHeapSize - initialMemory.usedJSHeapSize;
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    });
    
    test('should handle network conditions gracefully', async ({ page }) => {
        const streamKey = 'network-test-stream';
        
        // Start stream under normal conditions
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Simulate slow network
        await BrowserTestUtils.simulateNetworkConditions(page, {
            downloadThroughput: 100000, // 100KB/s
            uploadThroughput: 50000,    // 50KB/s
            latency: 500                // 500ms
        });
        
        // Try to play stream under slow network
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Verify player handles slow network gracefully
        await page.waitForTimeout(10000);
        
        // Check if player shows appropriate loading state
        const playerStatus = await page.locator('#currentStreamStatus').textContent();
        expect(['Loading...', 'Connecting...', 'Playing', 'Ready']).toContain(playerStatus);
        
        // Restore normal network conditions
        await BrowserTestUtils.simulateNetworkConditions(page, {
            downloadThroughput: 10000000,
            uploadThroughput: 5000000,
            latency: 50
        });
    });
    
    test('should handle large numbers of DOM elements efficiently', async ({ page }) => {
        const streamKeys = Array.from({ length: 20 }, (_, i) => `dom-stream-${i + 1}`);
        
        // Start many streams to create many DOM elements
        for (const streamKey of streamKeys) {
            await streamSimulator.startStream(streamKey, { duration: 30 });
            await page.waitForTimeout(200); // Small delay to prevent overwhelming
        }
        
        // Wait for all streams to appear
        await page.waitForTimeout(5000);
        
        // Measure DOM query performance
        const startTime = Date.now();
        const streamCards = await page.locator('.stream-card').count();
        const queryTime = Date.now() - startTime;
        
        console.log(`📊 DOM query time for ${streamCards} elements: ${queryTime}ms`);
        expect(queryTime).toBeLessThan(500); // Should query within 500ms
        
        // Verify all streams are displayed
        expect(streamCards).toBe(streamKeys.length);
        
        // Test scrolling performance
        const scrollStartTime = Date.now();
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        const scrollTime = Date.now() - scrollStartTime;
        
        console.log(`📊 Scroll time: ${scrollTime}ms`);
        expect(scrollTime).toBeLessThan(100); // Should scroll within 100ms
    });
    
    test('should handle WebSocket message frequency efficiently', async ({ page }) => {
        let messageCount = 0;
        
        // Monitor WebSocket messages
        page.on('websocket', ws => {
            ws.on('framesent', () => messageCount++);
            ws.on('framereceived', () => messageCount++);
        });
        
        const streamKeys = Array.from({ length: 5 }, (_, i) => `ws-stream-${i + 1}`);
        
        // Start streams to generate WebSocket traffic
        for (const streamKey of streamKeys) {
            await streamSimulator.startStream(streamKey, { duration: 30 });
            await page.waitForTimeout(1000);
        }
        
        // Wait for WebSocket activity
        await page.waitForTimeout(10000);
        
        console.log(`📊 WebSocket messages in 10 seconds: ${messageCount}`);
        
        // Should not exceed reasonable message frequency
        expect(messageCount).toBeLessThan(1000); // Max 100 messages per second
    });
    
    test('should maintain UI performance during stream playback', async ({ page }) => {
        const streamKey = 'playback-perf-stream';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Start playback
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Wait for playback to start
        await page.waitForTimeout(5000);
        
        // Measure UI responsiveness during playback
        const startTime = Date.now();
        await page.click('button:has-text("Generate New Key")');
        const responseTime = Date.now() - startTime;
        
        console.log(`📊 UI response time during playback: ${responseTime}ms`);
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
        
        // Test other UI interactions
        await page.click('button:has-text("Refresh Streams")');
        await page.waitForTimeout(500);
        
        // Verify stream is still playing
        const playerStatus = await page.locator('#currentStreamStatus').textContent();
        expect(['Playing', 'Playing (FLV.js)', 'Ready']).toContain(playerStatus);
    });
    
    test('should handle rapid API calls efficiently', async ({ page }) => {
        const apiCalls = 10;
        const startTime = Date.now();
        
        // Make multiple API calls rapidly
        const promises = Array.from({ length: apiCalls }, () => 
            page.evaluate(() => fetch('/api/stats').then(r => r.json()))
        );
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        console.log(`📊 ${apiCalls} API calls completed in ${totalTime}ms`);
        console.log(`📊 Average response time: ${(totalTime / apiCalls).toFixed(2)}ms`);
        
        // All calls should succeed
        results.forEach(result => {
            expect(result.success).toBe(true);
        });
        
        // Average response time should be reasonable
        expect(totalTime / apiCalls).toBeLessThan(500); // Less than 500ms average
    });
    
    test('should handle browser tab switching efficiently', async ({ page, context }) => {
        const streamKey = 'tab-switch-stream';
        
        // Start stream
        await streamSimulator.startStream(streamKey, { duration: 60 });
        await BrowserTestUtils.waitForStream(page, streamKey);
        
        // Start playback
        const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
        await streamCard.locator('button:has-text("Watch")').click();
        
        // Wait for playback to start
        await page.waitForTimeout(5000);
        
        // Create new tab and switch
        const newPage = await context.newPage();
        await newPage.goto('about:blank');
        
        // Switch back to streaming tab
        await page.bringToFront();
        
        // Verify streaming continues
        await page.waitForTimeout(2000);
        const playerStatus = await page.locator('#currentStreamStatus').textContent();
        expect(['Playing', 'Playing (FLV.js)', 'Ready']).toContain(playerStatus);
        
        // Close new tab
        await newPage.close();
    });
});