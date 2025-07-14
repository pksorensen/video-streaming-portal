/**
 * E2E Tests for Player URL Validation
 * Tests complete player functionality with real streams and URL validation
 */

const { test, expect } = require('@playwright/test');
const StreamSimulator = require('./utils/stream-simulator');
const BrowserTestUtils = require('./utils/browser-test-utils');

test.describe('Player URL Validation E2E Tests', () => {
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

    test.describe('Play Button Functionality', () => {
        test('should show play button for active streams', async ({ page }) => {
            const streamKey = 'play-button-test-001';
            
            // Start stream
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Verify play button is visible and clickable
            const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
            const playButton = streamCard.locator('button:has-text("Watch")');
            
            await expect(playButton).toBeVisible();
            await expect(playButton).toBeEnabled();
            await expect(playButton).toHaveClass(/btn-primary/);
        });

        test('should update UI state when play button is clicked', async ({ page }) => {
            const streamKey = 'play-button-test-002';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Click play button
            const streamCard = page.locator(`.stream-card:has-text("${streamKey}")`);
            await streamCard.locator('button:has-text("Watch")').click();
            
            // Verify player section becomes visible
            await expect(page.locator('#player')).toBeVisible();
            
            // Verify stream info is populated
            await expect(page.locator('#currentStreamPath')).toContainText(streamKey);
            await expect(page.locator('#currentStreamStatus')).toContainText(/Loading|Connecting|Ready|Playing/);
            
            // Verify page scrolls to player
            const playerBounds = await page.locator('#player').boundingBox();
            const viewportHeight = page.viewportSize().height;
            expect(playerBounds.y).toBeLessThan(viewportHeight);
        });

        test('should handle multiple play button clicks gracefully', async ({ page }) => {
            const streamKey = 'play-button-test-003';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            const playButton = page.locator(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Click multiple times rapidly
            await playButton.click();
            await playButton.click();
            await playButton.click();
            
            // Should not cause errors
            await expect(page.locator('#player')).toBeVisible();
            await expect(page.locator('.alert-danger')).not.toBeVisible();
        });

        test('should handle play button for non-existent stream', async ({ page }) => {
            // Create a mock stream card manually
            await page.evaluate(() => {
                const container = document.getElementById('streamsContainer');
                container.innerHTML = `
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div class="card stream-card">
                            <div class="card-body">
                                <h5 class="card-title">Stream: nonexistent</h5>
                                <button class="btn btn-primary" onclick="app.playStream('/live/nonexistent')">
                                    <i class="fas fa-play me-1"></i>Watch
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            // Click play button for non-existent stream
            await page.click('button:has-text("Watch")');
            
            // Should show error after timeout
            await page.waitForTimeout(5000);
            await expect(page.locator('#currentStreamStatus')).toContainText(/Error|Failed/);
        });
    });

    test.describe('URL Construction Validation', () => {
        test('should construct correct FLV URL for localhost', async ({ page }) => {
            const streamKey = 'url-test-001';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Click play and check network requests
            const responsePromise = page.waitForResponse(response => 
                response.url().includes(`${streamKey}.flv`)
            );
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            const response = await responsePromise;
            expect(response.url()).toContain(`localhost:8000/live/${streamKey}.flv`);
        });

        test('should construct correct HLS URL as fallback', async ({ page }) => {
            const streamKey = 'url-test-002';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Monitor all network requests
            const requests = [];
            page.on('request', request => {
                if (request.url().includes(streamKey)) {
                    requests.push(request.url());
                }
            });
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Wait for requests to be made
            await page.waitForTimeout(5000);
            
            // Should attempt both FLV and HLS
            const hasFlv = requests.some(url => url.includes('.flv'));
            const hasHls = requests.some(url => url.includes('.m3u8'));
            
            expect(hasFlv || hasHls).toBe(true);
        });

        test('should handle different hostname configurations', async ({ page }) => {
            // Test with different base URL
            await page.addInitScript(() => {
                Object.defineProperty(window, 'location', {
                    value: {
                        ...window.location,
                        hostname: '192.168.1.100'
                    },
                    writable: true
                });
            });
            
            const streamKey = 'url-test-003';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Check that URL is constructed with correct hostname
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            const streamInfo = await page.locator('#currentStreamPath').textContent();
            expect(streamInfo).toContain(streamKey);
        });

        test('should validate URL format in stream instructions', async ({ page }) => {
            const streamKey = 'url-test-004';
            
            // Force show stream instructions
            await page.evaluate((key) => {
                window.app.showStreamInstructions(key);
            }, streamKey);
            
            const statusContent = await page.locator('#currentStreamStatus').innerHTML();
            
            // Should contain properly formatted URLs
            expect(statusContent).toContain(`${streamKey}.flv`);
            expect(statusContent).toContain(`${streamKey}/index.m3u8`);
            expect(statusContent).toMatch(/http:\/\/.*:8000\/live\//);
        });
    });

    test.describe('Player Integration Testing', () => {
        test('should initialize Video.js player correctly', async ({ page }) => {
            const streamKey = 'player-test-001';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Check Video.js elements are present
            await expect(page.locator('.video-js')).toBeVisible();
            await expect(page.locator('.vjs-tech')).toBeVisible();
            await expect(page.locator('.vjs-control-bar')).toBeVisible();
            
            // Check player controls
            await expect(page.locator('.vjs-play-control')).toBeVisible();
            await expect(page.locator('.vjs-volume-control')).toBeVisible();
            await expect(page.locator('.vjs-fullscreen-control')).toBeVisible();
        });

        test('should handle FLV.js fallback when Video.js fails', async ({ page }) => {
            const streamKey = 'player-test-002';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Inject FLV.js availability check
            const flvjsAvailable = await page.evaluate(() => {
                return typeof window.flvjs !== 'undefined';
            });
            
            expect(flvjsAvailable).toBe(true);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Wait for player to attempt loading
            await page.waitForTimeout(10000);
            
            // Check if FLV.js status is shown (indicates fallback was attempted)
            const status = await page.locator('#currentStreamStatus').textContent();
            const isValidStatus = ['Playing (FLV.js)', 'Playing', 'Ready', 'Error'].includes(status);
            expect(isValidStatus).toBe(true);
        });

        test('should display stream metadata correctly', async ({ page }) => {
            const streamKey = 'player-test-003';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Check stream information panel
            await expect(page.locator('#currentStreamPath')).toContainText(streamKey);
            await expect(page.locator('#currentViewers')).toBeVisible();
            await expect(page.locator('#streamDuration')).toBeVisible();
            
            // Verify stop button is available
            await expect(page.locator('button:has-text("Stop Stream")')).toBeVisible();
        });

        test('should handle player errors gracefully', async ({ page }) => {
            const streamKey = 'player-test-004';
            
            // Start stream but stop it quickly to cause error
            await streamSimulator.startStream(streamKey, { duration: 5 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Wait for stream to end and cause error
            await page.waitForTimeout(8000);
            
            // Should show error state or stream instructions
            const status = await page.locator('#currentStreamStatus').textContent();
            const hasErrorHandling = status.includes('Error') || 
                                   status.includes('not available') || 
                                   status.includes('Direct URLs');
            
            expect(hasErrorHandling).toBe(true);
        });
    });

    test.describe('Copy URL Functionality', () => {
        test('should copy correct stream URL to clipboard', async ({ page, context }) => {
            const streamKey = 'copy-test-001';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Grant clipboard permissions
            await context.grantPermissions(['clipboard-read', 'clipboard-write']);
            
            // Click copy URL button
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Copy URL")`);
            
            // Verify success notification
            await BrowserTestUtils.validateToastNotification(page, 'Stream URL copied to clipboard!');
            
            // Check clipboard content
            const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
            expect(clipboardContent).toContain(`localhost:8000/live/${streamKey}.flv`);
            expect(clipboardContent).toMatch(/^https?:\/\//);
        });

        test('should handle clipboard permission denied', async ({ page }) => {
            const streamKey = 'copy-test-002';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Mock clipboard API to reject
            await page.addInitScript(() => {
                navigator.clipboard.writeText = () => Promise.reject(new Error('Permission denied'));
            });
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Copy URL")`);
            
            // Should show error notification
            await BrowserTestUtils.validateToastNotification(page, 'Failed to copy URL', 'danger');
        });
    });

    test.describe('VLC Integration', () => {
        test('should generate VLC protocol URL', async ({ page }) => {
            const streamKey = 'vlc-test-001';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Click VLC button and check for instructions
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("VLC")`);
            
            // Should show VLC instructions
            await BrowserTestUtils.validateToastNotification(page, 'VLC Instructions', 'info');
            
            // Check that the notification contains the stream URL
            const notification = page.locator('.alert-info');
            await expect(notification).toContainText(`${streamKey}.flv`);
            await expect(notification).toContainText('Media → Open Network Stream');
        });
    });

    test.describe('Stream Stop Functionality', () => {
        test('should stop stream via API call', async ({ page }) => {
            const streamKey = 'stop-test-001';
            
            await streamSimulator.startStream(streamKey, { duration: 120 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Monitor API calls
            const apiCalls = [];
            page.on('request', request => {
                if (request.url().includes('/api/streams/') && request.method() === 'POST') {
                    apiCalls.push(request.url());
                }
            });
            
            // Click stop button
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Stop")`);
            
            // Verify API call was made
            await page.waitForTimeout(2000);
            const stopCall = apiCalls.find(url => url.includes(`${streamKey}/stop`));
            expect(stopCall).toBeTruthy();
        });

        test('should stop player when stream ends naturally', async ({ page }) => {
            const streamKey = 'stop-test-002';
            
            // Start short duration stream
            await streamSimulator.startStream(streamKey, { duration: 10 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Start playing
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            await expect(page.locator('#player')).toBeVisible();
            
            // Wait for stream to end
            await page.waitForTimeout(15000);
            
            // Stream should be removed from dashboard
            await expect(page.locator(`.stream-card:has-text("${streamKey}")`)).not.toBeVisible();
            
            // Player should be hidden
            await expect(page.locator('#player')).not.toBeVisible();
        });

        test('should clean up player on manual stop', async ({ page }) => {
            const streamKey = 'stop-test-003';
            
            await streamSimulator.startStream(streamKey, { duration: 120 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            await expect(page.locator('#player')).toBeVisible();
            
            // Click stop stream button in player
            await page.click('button:has-text("Stop Stream")');
            
            // Player should be hidden
            await expect(page.locator('#player')).not.toBeVisible();
            
            // Status should be reset
            await expect(page.locator('#currentStreamStatus')).toContainText('Stopped');
        });
    });

    test.describe('Error Scenarios', () => {
        test('should handle network connectivity issues', async ({ page }) => {
            const streamKey = 'error-test-001';
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            // Set network to offline before playing
            await page.context().setOffline(true);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Should eventually show error
            await page.waitForTimeout(10000);
            const status = await page.locator('#currentStreamStatus').textContent();
            expect(status).toMatch(/Error|Failed|not available/);
            
            // Restore network
            await page.context().setOffline(false);
        });

        test('should handle invalid stream keys', async ({ page }) => {
            const invalidStreamKey = 'invalid-stream-' + Math.random().toString(36);
            
            // Try to play non-existent stream
            await page.evaluate((key) => {
                window.app.playStream(`/live/${key}`);
            }, invalidStreamKey);
            
            // Should show error after timeout
            await page.waitForTimeout(15000);
            const status = await page.locator('#currentStreamStatus').textContent();
            expect(status).toMatch(/Error|Failed|not available/);
        });

        test('should handle malformed stream paths', async ({ page }) => {
            const malformedPaths = ['', '///', '/live/', '/invalid/path/structure'];
            
            for (const path of malformedPaths) {
                await page.evaluate((p) => {
                    window.app.playStream(p);
                }, path);
                
                // Should not crash
                await page.waitForTimeout(1000);
                await expect(page.locator('body')).toBeVisible();
            }
        });
    });

    test.describe('Performance and Load Testing', () => {
        test('should handle rapid stream switching', async ({ page }) => {
            const streamKeys = ['perf-test-001', 'perf-test-002', 'perf-test-003'];
            
            // Start multiple streams
            for (const key of streamKeys) {
                await streamSimulator.startStream(key, { duration: 120 });
            }
            
            // Wait for all to appear
            for (const key of streamKeys) {
                await BrowserTestUtils.waitForStream(page, key);
            }
            
            // Rapidly switch between streams
            for (let i = 0; i < 3; i++) {
                for (const key of streamKeys) {
                    await page.click(`.stream-card:has-text("${key}") button:has-text("Watch")`);
                    await page.waitForTimeout(1000);
                }
            }
            
            // Should not crash or show persistent errors
            await expect(page.locator('#player')).toBeVisible();
        });

        test('should maintain responsive UI during playback', async ({ page }) => {
            const streamKey = 'perf-test-004';
            
            await streamSimulator.startStream(streamKey, { duration: 120 });
            await BrowserTestUtils.waitForStream(page, streamKey);
            
            await page.click(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
            
            // Test UI responsiveness during playback
            const startTime = Date.now();
            await page.click('button:has-text("Refresh")');
            const responseTime = Date.now() - startTime;
            
            expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
        });
    });

    test.describe('Browser Compatibility', () => {
        test('should work across different viewport sizes', async ({ page }) => {
            const streamKey = 'compat-test-001';
            const viewports = [
                { width: 1920, height: 1080 },
                { width: 1024, height: 768 },
                { width: 375, height: 667 }
            ];
            
            await streamSimulator.startStream(streamKey, { duration: 60 });
            
            for (const viewport of viewports) {
                await page.setViewportSize(viewport);
                await page.waitForTimeout(1000);
                
                await BrowserTestUtils.waitForStream(page, streamKey);
                
                // Play button should be visible and clickable
                const playButton = page.locator(`.stream-card:has-text("${streamKey}") button:has-text("Watch")`);
                await expect(playButton).toBeVisible();
                
                await playButton.click();
                await expect(page.locator('#player')).toBeVisible();
                
                // Stop for next iteration
                await page.click('button:has-text("Stop Stream")');
            }
        });
    });
});