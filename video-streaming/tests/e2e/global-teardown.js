/**
 * Global Teardown for Playwright E2E Tests
 * Cleans up test environment, stops services, and saves test artifacts
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

async function globalTeardown() {
    console.log('🧹 Starting global teardown for E2E tests...');
    
    // Stop any running test streams
    await stopTestStreams();
    
    // Clean up test artifacts
    await cleanupTestArtifacts();
    
    // Generate test summary
    await generateTestSummary();
    
    console.log('✅ Global teardown completed successfully');
}

async function stopTestStreams() {
    console.log('🛑 Stopping test streams...');
    
    try {
        // Kill any running ffmpeg processes
        await execAsync('pkill -f "ffmpeg.*rtmp://localhost:1935/live" || true');
        
        // Clean up PID files
        await execAsync('rm -f /tmp/stream_*.pid || true');
        
        console.log('✅ Test streams stopped');
    } catch (error) {
        console.warn('⚠️ Error stopping test streams:', error.message);
    }
}

async function cleanupTestArtifacts() {
    console.log('🧹 Cleaning up test artifacts...');
    
    try {
        // List of temporary files/directories to clean up
        const cleanupPaths = [
            'tests/e2e/fixtures/temp',
            'tests/e2e/temp',
            '.tmp',
            'recordings/test-*'
        ];
        
        for (const cleanupPath of cleanupPaths) {
            try {
                await fs.rm(cleanupPath, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        console.log('✅ Test artifacts cleaned up');
    } catch (error) {
        console.warn('⚠️ Error cleaning up test artifacts:', error.message);
    }
}

async function generateTestSummary() {
    console.log('📊 Generating test summary...');
    
    try {
        const summary = {
            timestamp: new Date().toISOString(),
            testRun: {
                environment: process.env.NODE_ENV || 'test',
                duration: process.env.TEST_DURATION || 'unknown',
                status: 'completed'
            },
            artifacts: {
                reports: 'test-results/playwright-report',
                screenshots: 'test-results/screenshots',
                videos: 'test-results/videos',
                traces: 'test-results/traces'
            },
            cleanup: {
                testStreams: 'stopped',
                tempFiles: 'cleaned',
                processes: 'terminated'
            }
        };
        
        await fs.writeFile(
            'test-results/test-summary.json',
            JSON.stringify(summary, null, 2)
        );
        
        console.log('✅ Test summary generated');
    } catch (error) {
        console.warn('⚠️ Error generating test summary:', error.message);
    }
}

module.exports = globalTeardown;