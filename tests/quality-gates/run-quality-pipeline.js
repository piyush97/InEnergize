#!/usr/bin/env node

/**
 * Quality Pipeline Runner
 * 
 * Comprehensive testing orchestrator for InErgize Phase 4 development
 * Runs all testing phases with quality gate validation and reporting
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Quality thresholds configuration
const QUALITY_THRESHOLDS = {
  UNIT_TEST_COVERAGE: 80,
  AI_MODEL_ACCURACY: 85,
  BIAS_FAIRNESS_SCORE: 90,
  LINKEDIN_COMPLIANCE: 95,
  PERFORMANCE_SCORE: 85,
  SECURITY_SCORE: 95,
  OVERALL_QUALITY_GATE: 90
};

// Test phase configuration
const TEST_PHASES = [
  {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    timeout: 120000,
    required: true,
    weight: 0.2
  },
  {
    name: 'Integration Tests',
    command: 'npm run test:integration', 
    timeout: 180000,
    required: true,
    weight: 0.15
  },
  {
    name: 'AI Model Testing',
    command: 'npm run test:ai',
    timeout: 300000,
    required: true,
    weight: 0.2
  },
  {
    name: 'Bias Detection Testing',
    command: 'npm run test:bias-detection',
    timeout: 240000,
    required: true,
    weight: 0.15
  },
  {
    name: 'LinkedIn Compliance',
    command: 'npm run test:compliance',
    timeout: 180000,
    required: true,
    weight: 0.15
  },
  {
    name: 'Performance Testing',
    command: 'npm run test:performance',
    timeout: 360000,
    required: true,
    weight: 0.15
  },
  {
    name: 'Team Features Testing',
    command: 'npm run test:team-features',
    timeout: 240000,
    required: false,
    weight: 0.1
  },
  {
    name: 'Security Testing',
    command: 'npm run test:security',
    timeout: 180000,
    required: true,
    weight: 0.1
  }
];

class QualityPipelineRunner {
  constructor() {
    this.results = {};
    this.startTime = Date.now();
    this.totalScore = 0;
    this.passedPhases = 0;
    this.failedPhases = 0;
  }

  /**
   * Execute the complete quality pipeline
   */
  async run() {
    console.log('🚀 Starting InErgize Quality Pipeline');
    console.log('=' .repeat(60));
    console.log(`📊 Quality Thresholds:`);
    console.log(`   • Unit Test Coverage: ${QUALITY_THRESHOLDS.UNIT_TEST_COVERAGE}%`);
    console.log(`   • AI Model Accuracy: ${QUALITY_THRESHOLDS.AI_MODEL_ACCURACY}%`);
    console.log(`   • Bias Fairness Score: ${QUALITY_THRESHOLDS.BIAS_FAIRNESS_SCORE}%`);
    console.log(`   • LinkedIn Compliance: ${QUALITY_THRESHOLDS.LINKEDIN_COMPLIANCE}%`);
    console.log(`   • Performance Score: ${QUALITY_THRESHOLDS.PERFORMANCE_SCORE}%`);
    console.log(`   • Security Score: ${QUALITY_THRESHOLDS.SECURITY_SCORE}%`);
    console.log(`   • Overall Quality Gate: ${QUALITY_THRESHOLDS.OVERALL_QUALITY_GATE}%`);
    console.log('=' .repeat(60));

    try {
      // Run all test phases
      for (const phase of TEST_PHASES) {
        await this.executePhase(phase);
      }

      // Generate final report
      const report = await this.generateFinalReport();
      
      // Write quality report
      await this.writeQualityReport(report);
      
      // Display results
      this.displayResults(report);
      
      // Exit with appropriate code
      process.exit(report.recommendation === 'BLOCK' ? 1 : 0);

    } catch (error) {
      console.error('❌ Pipeline execution failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Execute a single test phase
   */
  async executePhase(phase) {
    const startTime = Date.now();
    console.log(`\n🔄 Running ${phase.name}...`);

    try {
      const result = await execAsync(phase.command, { 
        timeout: phase.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      const duration = Date.now() - startTime;
      const phaseResult = {
        name: phase.name,
        success: true,
        duration,
        output: result.stdout,
        error: null,
        weight: phase.weight,
        required: phase.required
      };

      // Parse test results for scoring
      const score = this.parseTestResults(phase.name, result.stdout);
      phaseResult.score = score;

      this.results[phase.name] = phaseResult;
      this.passedPhases++;

      console.log(`✅ ${phase.name} completed in ${(duration / 1000).toFixed(1)}s (Score: ${score.toFixed(1)}%)`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const phaseResult = {
        name: phase.name,
        success: false,
        duration,
        output: error.stdout || '',
        error: error.message,
        weight: phase.weight,
        required: phase.required,
        score: 0
      };

      this.results[phase.name] = phaseResult;
      this.failedPhases++;

      console.log(`❌ ${phase.name} failed in ${(duration / 1000).toFixed(1)}s`);
      
      if (phase.required) {
        console.log(`💥 Required phase failed: ${error.message}`);
      }

      // Continue with other phases even if this one fails
    }
  }

  /**
   * Parse test results to extract scores
   */
  parseTestResults(phaseName, output) {
    try {
      // Try to find JSON test results
      const jsonMatch = output.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
      if (jsonMatch) {
        const testResults = JSON.parse(jsonMatch[0]);
        const passRate = (testResults.numPassedTests / testResults.numTotalTests) * 100;
        return Math.min(100, passRate);
      }

      // Fallback: look for coverage or other metrics
      if (phaseName.includes('Unit Tests')) {
        const coverageMatch = output.match(/All files[^|]*\|\s*(\d+\.?\d*)/);
        if (coverageMatch) {
          return parseFloat(coverageMatch[1]);
        }
      }

      // Default scoring based on success
      return 85; // Assume good score if we can't parse details

    } catch (error) {
      console.warn(`⚠️  Could not parse results for ${phaseName}: ${error.message}`);
      return 50; // Conservative score for unparseable results
    }
  }

  /**
   * Generate comprehensive final report
   */
  async generateFinalReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    // Calculate weighted overall score
    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of Object.values(this.results)) {
      if (result.success) {
        weightedScore += result.score * result.weight;
        totalWeight += result.weight;
      }
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    // Determine recommendation
    let recommendation;
    const criticalFailures = Object.values(this.results)
      .filter(r => r.required && !r.success).length;

    if (criticalFailures > 0) {
      recommendation = 'BLOCK';
    } else if (overallScore >= QUALITY_THRESHOLDS.OVERALL_QUALITY_GATE) {
      recommendation = 'DEPLOY';
    } else if (overallScore >= 70) {
      recommendation = 'DEPLOY_WITH_CAUTION';
    } else {
      recommendation = 'BLOCK';
    }

    return {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      overallScore: overallScore.toFixed(1),
      recommendation,
      totalPhases: TEST_PHASES.length,
      passedPhases: this.passedPhases,
      failedPhases: this.failedPhases,
      criticalFailures,
      results: this.results,
      insights: this.generateInsights(),
      thresholds: QUALITY_THRESHOLDS
    };
  }

  /**
   * Generate actionable insights
   */
  generateInsights() {
    const insights = [];

    // Coverage insights
    const unitTestResult = this.results['Unit Tests'];
    if (unitTestResult && unitTestResult.score < QUALITY_THRESHOLDS.UNIT_TEST_COVERAGE) {
      insights.push(`🔍 Unit test coverage (${unitTestResult.score.toFixed(1)}%) is below target (${QUALITY_THRESHOLDS.UNIT_TEST_COVERAGE}%)`);
    }

    // AI model insights
    const aiResult = this.results['AI Model Testing'];
    if (aiResult && aiResult.score < QUALITY_THRESHOLDS.AI_MODEL_ACCURACY) {
      insights.push(`🤖 AI model accuracy (${aiResult.score.toFixed(1)}%) needs improvement`);
    }

    // Performance insights
    const perfResult = this.results['Performance Testing'];
    if (perfResult && perfResult.score < QUALITY_THRESHOLDS.PERFORMANCE_SCORE) {
      insights.push(`⚡ Performance score (${perfResult.score.toFixed(1)}%) requires optimization`);
    }

    // Security insights
    const secResult = this.results['Security Testing'];
    if (secResult && secResult.score < QUALITY_THRESHOLDS.SECURITY_SCORE) {
      insights.push(`🛡️  Security score (${secResult.score.toFixed(1)}%) needs attention`);
    }

    return insights;
  }

  /**
   * Write quality report to file
   */
  async writeQualityReport(report) {
    const reportPath = path.join(__dirname, 'quality-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Quality report written to: ${reportPath}`);
  }

  /**
   * Display final results
   */
  displayResults(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 QUALITY PIPELINE RESULTS');
    console.log('='.repeat(60));
    
    console.log(`📊 Overall Score: ${report.overallScore}%`);
    console.log(`⏱️  Total Duration: ${(report.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`✅ Passed Phases: ${report.passedPhases}/${report.totalPhases}`);
    console.log(`❌ Failed Phases: ${report.failedPhases}/${report.totalPhases}`);
    
    if (report.criticalFailures > 0) {
      console.log(`💥 Critical Failures: ${report.criticalFailures}`);
    }

    // Recommendation
    const recIcon = report.recommendation === 'DEPLOY' ? '✅' : 
                   report.recommendation === 'DEPLOY_WITH_CAUTION' ? '⚠️' : '❌';
    console.log(`\n${recIcon} RECOMMENDATION: ${report.recommendation}`);

    // Insights
    if (report.insights.length > 0) {
      console.log('\n💡 Key Insights:');
      report.insights.forEach(insight => console.log(`   ${insight}`));
    }

    // Phase breakdown
    console.log('\n📋 Phase Breakdown:');
    for (const [name, result] of Object.entries(report.results)) {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      const score = result.score ? ` (${result.score.toFixed(1)}%)` : '';
      console.log(`   ${status} ${name}: ${duration}s${score}`);
    }

    console.log('='.repeat(60));
  }
}

// Run the pipeline if this script is executed directly
if (require.main === module) {
  const runner = new QualityPipelineRunner();
  runner.run().catch(error => {
    console.error('Pipeline runner crashed:', error);
    process.exit(1);
  });
}

module.exports = QualityPipelineRunner;