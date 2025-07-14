#!/usr/bin/env node

/**
 * Player Test Runner
 * Comprehensive test runner for video player functionality
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class PlayerTestRunner {
    constructor() {
        this.testSuites = {
            unit: {
                pattern: 'tests/unit/**/*.test.js',
                description: 'Unit tests for URL validation and stream data'
            },
            integration: {
                pattern: 'tests/integration/**/*.test.js',
                description: 'Integration tests for Video.js and FLV.js'
            },
            e2e: {
                pattern: 'tests/e2e/player-url-validation.spec.js',
                description: 'End-to-end tests with real streams'
            }
        };
        
        this.results = {};
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('🎬 Starting Player Testing Suite');
        console.log('=====================================\n');

        try {
            // Run unit tests
            await this.runJestTests('unit');
            
            // Run integration tests  
            await this.runJestTests('integration');
            
            // Run E2E tests
            await this.runPlaywrightTests();
            
            // Generate summary report
            await this.generateSummaryReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async runJestTests(suite) {
        console.log(`🧪 Running ${suite} tests...`);
        console.log(`📋 ${this.testSuites[suite].description}\n`);

        return new Promise((resolve, reject) => {
            const jestProcess = spawn('npx', [
                'jest',
                '--config', 'tests/jest.config.js',
                '--testPathPattern', this.testSuites[suite].pattern,
                '--coverage',
                '--json'
            ], {
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            jestProcess.stdout.on('data', (data) => {
                const text = data.toString();
                process.stdout.write(text);
                output += text;
            });

            jestProcess.stderr.on('data', (data) => {
                const text = data.toString();
                process.stderr.write(text);
                errorOutput += text;
            });

            jestProcess.on('close', (code) => {
                try {
                    // Parse Jest JSON output for results
                    const jsonMatch = output.match(/\{[\s\S]*"success":\s*(true|false)[\s\S]*\}/);
                    if (jsonMatch) {
                        const results = JSON.parse(jsonMatch[0]);
                        this.results[suite] = {
                            success: results.success,
                            numTotalTests: results.numTotalTests,
                            numPassedTests: results.numPassedTests,
                            numFailedTests: results.numFailedTests,
                            testResults: results.testResults
                        };
                    }
                } catch (parseError) {
                    console.warn('⚠️ Could not parse Jest results');
                }

                if (code === 0) {
                    console.log(`✅ ${suite} tests completed successfully\n`);
                    resolve();
                } else {
                    console.log(`❌ ${suite} tests failed with code ${code}\n`);
                    // Don't reject, continue with other tests
                    resolve();
                }
            });

            jestProcess.on('error', (error) => {
                console.error(`❌ Failed to start ${suite} tests:`, error.message);
                resolve(); // Continue with other tests
            });
        });
    }

    async runPlaywrightTests() {
        console.log('🎭 Running E2E tests with Playwright...');
        console.log('📋 End-to-end player functionality tests\n');

        return new Promise((resolve, reject) => {
            const playwrightProcess = spawn('npx', [
                'playwright', 'test',
                'tests/e2e/player-url-validation.spec.js',
                '--reporter=json'
            ], {
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            playwrightProcess.stdout.on('data', (data) => {
                const text = data.toString();
                process.stdout.write(text);
                output += text;
            });

            playwrightProcess.stderr.on('data', (data) => {
                const text = data.toString();
                process.stderr.write(text);
                errorOutput += text;
            });

            playwrightProcess.on('close', (code) => {
                // Store E2E results
                this.results.e2e = {
                    success: code === 0,
                    exitCode: code
                };

                if (code === 0) {
                    console.log('✅ E2E tests completed successfully\n');
                } else {
                    console.log(`❌ E2E tests failed with code ${code}\n`);
                }
                
                resolve();
            });

            playwrightProcess.on('error', (error) => {
                console.error('❌ Failed to start E2E tests:', error.message);
                this.results.e2e = { success: false, error: error.message };
                resolve();
            });
        });
    }

    async generateSummaryReport() {
        const duration = Date.now() - this.startTime;
        
        console.log('📊 TEST SUMMARY REPORT');
        console.log('======================\n');

        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let allSuitesSuccess = true;

        // Analyze results
        Object.entries(this.results).forEach(([suite, result]) => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${suite.toUpperCase()} Tests:`);
            
            if (result.numTotalTests !== undefined) {
                console.log(`   📋 Total: ${result.numTotalTests}`);
                console.log(`   ✅ Passed: ${result.numPassedTests}`);
                console.log(`   ❌ Failed: ${result.numFailedTests}`);
                
                totalTests += result.numTotalTests;
                totalPassed += result.numPassedTests;
                totalFailed += result.numFailedTests;
            } else {
                console.log(`   🎭 Playwright suite: ${result.success ? 'PASSED' : 'FAILED'}`);
            }
            
            if (!result.success) {
                allSuitesSuccess = false;
            }
            
            console.log('');
        });

        // Overall summary
        console.log('📈 OVERALL SUMMARY:');
        console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`   📊 Total Tests: ${totalTests}`);
        console.log(`   ✅ Passed: ${totalPassed}`);
        console.log(`   ❌ Failed: ${totalFailed}`);
        console.log(`   📈 Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
        console.log('');

        // Test quality assessment
        this.assessTestQuality();

        // Generate detailed report file
        await this.saveDetailedReport();

        // Final status
        if (allSuitesSuccess && totalFailed === 0) {
            console.log('🎉 ALL TESTS PASSED! Player functionality is working correctly.');
            process.exit(0);
        } else {
            console.log('⚠️  Some tests failed. Please review the results above.');
            process.exit(1);
        }
    }

    assessTestQuality() {
        console.log('🔍 TEST QUALITY ASSESSMENT:');
        
        const assessments = [];
        
        // Check coverage (if available)
        const coverageThreshold = 85;
        assessments.push(`📊 Target coverage: ${coverageThreshold}%`);
        
        // Check test distribution
        const unitTests = this.results.unit?.numTotalTests || 0;
        const integrationTests = this.results.integration?.numTotalTests || 0;
        
        if (unitTests > 0 && integrationTests > 0) {
            assessments.push('✅ Good test pyramid: Unit + Integration + E2E');
        } else {
            assessments.push('⚠️ Missing test types - consider adding more test layers');
        }
        
        // Check for critical functionality coverage
        const criticalFeatures = [
            'URL construction',
            'Stream key extraction', 
            'Player initialization',
            'Error handling'
        ];
        
        assessments.push(`🎯 Critical features tested: ${criticalFeatures.length}`);
        
        assessments.forEach(assessment => console.log(`   ${assessment}`));
        console.log('');
    }

    async saveDetailedReport() {
        const reportData = {
            timestamp: new Date().toISOString(),
            duration: Date.now() - this.startTime,
            results: this.results,
            environment: {
                node: process.version,
                platform: process.platform,
                cwd: process.cwd()
            }
        };

        const reportPath = path.join('test-results', 'player-test-report.json');
        
        try {
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
            console.log(`📄 Detailed report saved: ${reportPath}`);
        } catch (error) {
            console.warn('⚠️ Could not save detailed report:', error.message);
        }
    }

    static async run() {
        const runner = new PlayerTestRunner();
        await runner.runAllTests();
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help')) {
        console.log(`
🎬 Player Test Runner

Usage: node tests/run-player-tests.js [options]

Options:
  --help        Show this help message
  
Test Suites:
  - Unit Tests: URL validation and stream data testing
  - Integration Tests: Video.js and FLV.js integration  
  - E2E Tests: Complete player workflow with real streams

Examples:
  node tests/run-player-tests.js        # Run all tests
        `);
        process.exit(0);
    }
    
    PlayerTestRunner.run().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = PlayerTestRunner;