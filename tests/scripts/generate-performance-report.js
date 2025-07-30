#!/usr/bin/env node

/**
 * Performance Report Generator
 * 
 * Generates comprehensive HTML performance reports from test results
 * Supports Jest, K6, and custom performance test formats
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// CLI configuration
program
  .option('-t, --test-name <name>', 'Name of the test')
  .option('-r, --results-dir <dir>', 'Directory containing test results')
  .option('-o, --output-file <file>', 'Output HTML file path')
  .option('--thresholds <json>', 'Performance thresholds as JSON string')
  .option('--template <file>', 'Custom HTML template file')
  .parse();

const options = program.opts();

// Validate required options
if (!options.testName || !options.resultsDir || !options.outputFile) {
  console.error('❌ Missing required options: --test-name, --results-dir, and --output-file are required');
  process.exit(1);
}

// Performance thresholds
const thresholds = options.thresholds ? JSON.parse(options.thresholds) : {
  websocket_latency_p95: 100,
  websocket_latency_p99: 200,
  websocket_error_rate: 0.05,
  api_response_time_p95: 500,
  api_response_time_p99: 1000,
  api_error_rate: 0.10,
  queue_processing_success_rate: 0.95,
  safety_check_response_time: 1000,
  memory_usage_mb: 512,
  cpu_usage_percent: 80
};

class PerformanceReportGenerator {
  constructor(testName, resultsDir, outputFile, thresholds) {
    this.testName = testName;
    this.resultsDir = resultsDir;
    this.outputFile = outputFile;
    this.thresholds = thresholds;
    this.results = {
      jest: null,
      k6: null,
      custom: []
    };
  }

  async generate() {
    console.log(`🚀 Generating performance report for: ${this.testName}`);
    
    try {
      await this.loadResults();
      const report = await this.generateHTML();
      await this.writeReport(report);
      
      console.log(`✅ Performance report generated: ${this.outputFile}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to generate performance report:`, error.message);
      return false;
    }
  }

  async loadResults() {
    const jestFile = path.join(this.resultsDir, `jest-${this.testName}-results.json`);
    const k6File = path.join(this.resultsDir, `k6-${this.testName}-results.json`);

    // Load Jest results
    if (fs.existsSync(jestFile)) {
      try {
        const data = fs.readFileSync(jestFile, 'utf8');
        this.results.jest = JSON.parse(data);
        console.log(`📊 Loaded Jest results: ${this.results.jest.numTotalTests} tests`);
      } catch (error) {
        console.warn(`⚠️ Failed to load Jest results: ${error.message}`);
      }
    }

    // Load K6 results
    if (fs.existsSync(k6File)) {
      try {
        const data = fs.readFileSync(k6File, 'utf8');
        this.results.k6 = this.parseK6Results(data);
        console.log(`📊 Loaded K6 results: ${Object.keys(this.results.k6.metrics).length} metrics`);
      } catch (error) {
        console.warn(`⚠️ Failed to load K6 results: ${error.message}`);
      }
    }

    // Load custom results
    const customFiles = fs.readdirSync(this.resultsDir)
      .filter(file => file.includes(this.testName) && file.endsWith('.json') && 
              !file.includes('jest-') && !file.includes('k6-'));
    
    for (const file of customFiles) {
      try {
        const data = fs.readFileSync(path.join(this.resultsDir, file), 'utf8');
        this.results.custom.push({
          filename: file,
          data: JSON.parse(data)
        });
      } catch (error) {
        console.warn(`⚠️ Failed to load custom results from ${file}: ${error.message}`);
      }
    }
  }

  parseK6Results(rawData) {
    const lines = rawData.trim().split('\n');
    const metrics = {};
    const thresholds = {};
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        
        if (data.type === 'Metric') {
          metrics[data.data.name] = data.data;
        } else if (data.type === 'Threshold') {
          thresholds[data.data.name] = data.data;
        }
      } catch (error) {
        // Skip invalid JSON lines
      }
    }

    return { metrics, thresholds };
  }

  async generateHTML() {
    const templatePath = options.template || path.join(__dirname, 'templates', 'performance-report.html');
    let template;

    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf8');
    } else {
      template = this.getDefaultTemplate();
    }

    // Generate report data
    const reportData = {
      testName: this.testName,
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      metrics: this.generateMetrics(),
      charts: this.generateCharts(),
      recommendations: this.generateRecommendations()
    };

    // Replace template placeholders
    let report = template
      .replace(/{{testName}}/g, reportData.testName)
      .replace(/{{timestamp}}/g, new Date(reportData.timestamp).toLocaleString())
      .replace(/{{summary}}/g, reportData.summary)
      .replace(/{{metrics}}/g, reportData.metrics)
      .replace(/{{charts}}/g, reportData.charts)
      .replace(/{{recommendations}}/g, reportData.recommendations);

    return report;
  }

  generateSummary() {
    let summary = '<div class="summary-section">';
    
    // Test execution summary
    summary += '<h3>🎯 Test Execution Summary</h3>';
    summary += '<div class="summary-grid">';

    if (this.results.jest) {
      const { numTotalTests, numPassedTests, numFailedTests, success } = this.results.jest;
      summary += `
        <div class="summary-card ${success ? 'success' : 'failure'}">
          <h4>Jest Tests</h4>
          <div class="metric-value">${numPassedTests}/${numTotalTests}</div>
          <div class="metric-label">Tests Passed</div>
          <div class="metric-status">${success ? '✅ PASSED' : '❌ FAILED'}</div>
        </div>
      `;
    }

    if (this.results.k6) {
      const httpReqs = this.results.k6.metrics.http_reqs;
      const httpReqFailed = this.results.k6.metrics.http_req_failed;
      
      if (httpReqs && httpReqFailed) {
        const totalRequests = httpReqs.values.count;
        const failedRequests = Math.round(totalRequests * httpReqFailed.values.rate);
        const successRate = ((totalRequests - failedRequests) / totalRequests * 100).toFixed(2);
        
        summary += `
          <div class="summary-card ${parseFloat(successRate) >= 95 ? 'success' : 'warning'}">
            <h4>HTTP Requests</h4>
            <div class="metric-value">${successRate}%</div>
            <div class="metric-label">Success Rate</div>
            <div class="metric-status">${totalRequests.toLocaleString()} total requests</div>
          </div>
        `;
      }
    }

    summary += '</div>';
    
    // Performance metrics overview
    summary += '<h3>📊 Performance Metrics Overview</h3>';
    summary += this.generateMetricsTable();
    
    summary += '</div>';
    return summary;
  }

  generateMetricsTable() {
    let table = '<table class="metrics-table">';
    table += '<thead><tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th></tr></thead>';
    table += '<tbody>';

    const metrics = this.extractKeyMetrics();
    
    for (const [metricName, metricData] of Object.entries(metrics)) {
      const threshold = this.thresholds[metricName];
      const passed = this.checkThreshold(metricData.value, threshold, metricData.type);
      const status = passed ? '✅ PASS' : '❌ FAIL';
      const statusClass = passed ? 'success' : 'failure';

      table += `
        <tr class="${statusClass}">
          <td>${metricData.label}</td>
          <td>${this.formatMetricValue(metricData.value, metricData.unit)}</td>
          <td>${threshold ? this.formatMetricValue(threshold, metricData.unit) : 'N/A'}</td>
          <td class="status">${status}</td>
        </tr>
      `;
    }

    table += '</tbody></table>';
    return table;
  }

  extractKeyMetrics() {
    const metrics = {};

    // K6 metrics
    if (this.results.k6) {
      const k6Metrics = this.results.k6.metrics;
      
      // HTTP response times
      if (k6Metrics.http_req_duration) {
        metrics.api_response_time_p95 = {
          label: 'API Response Time (P95)',
          value: k6Metrics.http_req_duration.values['p(95)'],
          unit: 'ms',
          type: 'lower_is_better'
        };
        metrics.api_response_time_p99 = {
          label: 'API Response Time (P99)',
          value: k6Metrics.http_req_duration.values['p(99)'],
          unit: 'ms',
          type: 'lower_is_better'
        };
      }

      // HTTP error rate
      if (k6Metrics.http_req_failed) {
        metrics.api_error_rate = {
          label: 'API Error Rate',
          value: k6Metrics.http_req_failed.values.rate,
          unit: '%',
          type: 'lower_is_better'
        };
      }

      // WebSocket metrics
      if (k6Metrics.websocket_latency) {
        metrics.websocket_latency_p95 = {
          label: 'WebSocket Latency (P95)',
          value: k6Metrics.websocket_latency.values['p(95)'],
          unit: 'ms',
          type: 'lower_is_better'
        };
      }

      if (k6Metrics.websocket_errors) {
        metrics.websocket_error_rate = {
          label: 'WebSocket Error Rate',
          value: k6Metrics.websocket_errors.values.rate,
          unit: '%',
          type: 'lower_is_better'
        };
      }
    }

    // Jest test metrics (custom metrics from performance tests)
    if (this.results.jest && this.results.jest.testResults) {
      // Extract custom metrics from Jest test results
      for (const testResult of this.results.jest.testResults) {
        if (testResult.message && testResult.message.includes('Performance Metrics:')) {
          try {
            const metricsMatch = testResult.message.match(/Performance Metrics: ({.*})/);
            if (metricsMatch) {
              const customMetrics = JSON.parse(metricsMatch[1]);
              
              Object.entries(customMetrics).forEach(([key, value]) => {
                metrics[key] = {
                  label: this.formatMetricLabel(key),
                  value: value,
                  unit: this.inferMetricUnit(key),
                  type: 'lower_is_better'
                };
              });
            }
          } catch (error) {
            // Skip invalid JSON
          }
        }
      }
    }

    return metrics;
  }

  formatMetricLabel(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  inferMetricUnit(key) {
    if (key.includes('latency') || key.includes('time')) return 'ms';
    if (key.includes('rate') || key.includes('percent')) return '%';
    if (key.includes('memory')) return 'MB';
    if (key.includes('connections')) return 'count';
    return '';
  }

  formatMetricValue(value, unit) {
    if (typeof value !== 'number') return String(value);
    
    if (unit === '%') {
      return `${(value * 100).toFixed(2)}%`;
    } else if (unit === 'ms') {
      return `${value.toFixed(2)}ms`;
    } else if (unit === 'MB') {
      return `${value.toFixed(2)}MB`;
    } else {
      return value.toLocaleString();
    }
  }

  checkThreshold(value, threshold, type) {
    if (!threshold) return true;
    
    if (type === 'lower_is_better') {
      return value <= threshold;
    } else if (type === 'higher_is_better') {
      return value >= threshold;
    }
    
    return true;
  }

  generateMetrics() {
    let metricsHtml = '<div class="metrics-section">';
    
    // Detailed metrics from K6
    if (this.results.k6) {
      metricsHtml += '<h3>📈 Load Testing Metrics (K6)</h3>';
      metricsHtml += this.generateK6MetricsTable();
    }

    // Jest test details
    if (this.results.jest) {
      metricsHtml += '<h3>🧪 Unit/Integration Test Results</h3>';
      metricsHtml += this.generateJestMetricsTable();
    }

    // Custom metrics
    if (this.results.custom.length > 0) {
      metricsHtml += '<h3>🔧 Custom Metrics</h3>';
      metricsHtml += this.generateCustomMetricsTable();
    }

    metricsHtml += '</div>';
    return metricsHtml;
  }

  generateK6MetricsTable() {
    if (!this.results.k6 || !this.results.k6.metrics) return '';

    let table = '<table class="detailed-metrics-table">';
    table += '<thead><tr><th>Metric</th><th>Average</th><th>Min</th><th>Max</th><th>P90</th><th>P95</th><th>P99</th></tr></thead>';
    table += '<tbody>';

    for (const [name, metric] of Object.entries(this.results.k6.metrics)) {
      if (metric.values) {
        table += `
          <tr>
            <td><strong>${name}</strong></td>
            <td>${metric.values.avg ? metric.values.avg.toFixed(2) : 'N/A'}</td>
            <td>${metric.values.min ? metric.values.min.toFixed(2) : 'N/A'}</td>
            <td>${metric.values.max ? metric.values.max.toFixed(2) : 'N/A'}</td>
            <td>${metric.values['p(90)'] ? metric.values['p(90)'].toFixed(2) : 'N/A'}</td>
            <td>${metric.values['p(95)'] ? metric.values['p(95)'].toFixed(2) : 'N/A'}</td>
            <td>${metric.values['p(99)'] ? metric.values['p(99)'].toFixed(2) : 'N/A'}</td>
          </tr>
        `;
      }
    }

    table += '</tbody></table>';
    return table;
  }

  generateJestMetricsTable() {
    if (!this.results.jest) return '';

    let table = '<div class="jest-results">';
    
    // Overall summary
    table += `
      <div class="jest-summary">
        <div class="jest-stat">
          <span class="label">Total Tests:</span>
          <span class="value">${this.results.jest.numTotalTests}</span>
        </div>
        <div class="jest-stat">
          <span class="label">Passed:</span>
          <span class="value success">${this.results.jest.numPassedTests}</span>
        </div>
        <div class="jest-stat">
          <span class="label">Failed:</span>
          <span class="value ${this.results.jest.numFailedTests > 0 ? 'failure' : 'success'}">${this.results.jest.numFailedTests}</span>
        </div>
        <div class="jest-stat">
          <span class="label">Duration:</span>
          <span class="value">${(this.results.jest.runTime / 1000).toFixed(2)}s</span>
        </div>
      </div>
    `;

    // Test file results
    if (this.results.jest.testResults) {
      table += '<div class="test-files">';
      
      for (const testFile of this.results.jest.testResults) {
        const filename = path.basename(testFile.name);
        const status = testFile.status === 'passed' ? 'success' : 'failure';
        
        table += `
          <div class="test-file ${status}">
            <h4>${filename}</h4>
            <div class="test-file-stats">
              <span>Duration: ${(testFile.endTime - testFile.startTime)}ms</span>
              <span>Tests: ${testFile.numPassingTests}/${testFile.numPassingTests + testFile.numFailingTests}</span>
            </div>
          </div>
        `;
      }
      
      table += '</div>';
    }

    table += '</div>';
    return table;
  }

  generateCustomMetricsTable() {
    let content = '';
    
    for (const custom of this.results.custom) {
      content += `<h4>📄 ${custom.filename}</h4>`;
      content += '<pre class="custom-data">';
      content += JSON.stringify(custom.data, null, 2);
      content += '</pre>';
    }
    
    return content;
  }

  generateCharts() {
    // For now, return placeholder for charts
    // In a full implementation, this would generate Chart.js or D3.js visualizations
    return `
      <div class="charts-section">
        <h3>📊 Performance Visualizations</h3>
        <div class="chart-placeholder">
          <p>📈 Charts would be generated here with actual data visualization libraries</p>
          <p>Typical charts include:</p>
          <ul>
            <li>Response time trends over time</li>
            <li>Throughput and error rate graphs</li>
            <li>Resource utilization charts</li>
            <li>Percentile distribution plots</li>
          </ul>
        </div>
      </div>
    `;
  }

  generateRecommendations() {
    const recommendations = [];
    const metrics = this.extractKeyMetrics();

    // Analyze metrics and generate recommendations
    for (const [metricName, metricData] of Object.entries(metrics)) {
      const threshold = this.thresholds[metricName];
      if (threshold && !this.checkThreshold(metricData.value, threshold, metricData.type)) {
        recommendations.push({
          type: 'performance',
          severity: 'high',
          metric: metricName,
          message: `${metricData.label} (${this.formatMetricValue(metricData.value, metricData.unit)}) exceeds threshold (${this.formatMetricValue(threshold, metricData.unit)})`,
          suggestion: this.getSuggestionForMetric(metricName)
        });
      }
    }

    // Generate HTML
    let html = '<div class="recommendations-section">';
    html += '<h3>💡 Performance Recommendations</h3>';

    if (recommendations.length === 0) {
      html += '<div class="recommendation success">✅ All metrics are within acceptable thresholds. Great job!</div>';
    } else {
      for (const rec of recommendations) {
        html += `
          <div class="recommendation ${rec.severity}">
            <h4>⚠️ ${rec.message}</h4>
            <p><strong>Suggestion:</strong> ${rec.suggestion}</p>
          </div>
        `;
      }
    }

    html += '</div>';
    return html;
  }

  getSuggestionForMetric(metricName) {
    const suggestions = {
      api_response_time_p95: 'Consider optimizing database queries, implementing caching, or scaling API instances.',
      api_response_time_p99: 'Investigate outliers causing high tail latency. Check for resource contention or slow queries.',
      api_error_rate: 'Review error logs to identify common failure patterns. Implement circuit breakers and better error handling.',
      websocket_latency_p95: 'Check network configuration, WebSocket server performance, and message processing efficiency.',
      websocket_error_rate: 'Investigate connection stability, implement better reconnection logic, and monitor resource usage.',
      queue_processing_success_rate: 'Review queue worker configuration, error handling, and retry mechanisms.',
      memory_usage_mb: 'Investigate memory leaks, optimize data structures, and consider increasing available memory.',
      cpu_usage_percent: 'Profile CPU usage to identify bottlenecks. Consider optimizing algorithms or scaling horizontally.'
    };

    return suggestions[metricName] || 'Review the specific metric and consider performance optimization strategies.';
  }

  getDefaultTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - {{testName}}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2, h3 { color: #34495e; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.success { background: #d4edda; border-left: 4px solid #28a745; }
        .summary-card.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .summary-card.failure { background: #f8d7da; border-left: 4px solid #dc3545; }
        .metric-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .metric-label { color: #666; font-size: 0.9em; }
        .metric-status { margin-top: 10px; font-weight: bold; }
        .metrics-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .metrics-table th, .metrics-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .metrics-table th { background: #f8f9fa; font-weight: bold; }
        .metrics-table tr.success { background: #f8fff9; }
        .metrics-table tr.failure { background: #fff5f5; }
        .status { font-weight: bold; }
        .detailed-metrics-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .detailed-metrics-table th, .detailed-metrics-table td { padding: 8px; text-align: right; border-bottom: 1px solid #eee; }
        .detailed-metrics-table th { background: #f1f3f4; }
        .detailed-metrics-table td:first-child { text-align: left; }
        .jest-summary { display: flex; justify-content: space-around; background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .jest-stat { text-align: center; }
        .jest-stat .label { display: block; color: #666; font-size: 0.9em; }
        .jest-stat .value { display: block; font-size: 1.5em; font-weight: bold; margin-top: 5px; }
        .value.success { color: #28a745; }
        .value.failure { color: #dc3545; }
        .test-files { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin: 20px 0; }
        .test-file { padding: 15px; border-radius: 5px; }
        .test-file.success { background: #d4edda; border-left: 4px solid #28a745; }
        .test-file.failure { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-file h4 { margin: 0 0 10px 0; }
        .test-file-stats { font-size: 0.9em; color: #666; }
        .test-file-stats span { margin-right: 15px; }
        .custom-data { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .charts-section { margin: 30px 0; }
        .chart-placeholder { background: #f8f9fa; padding: 40px; text-align: center; border-radius: 5px; color: #666; }
        .recommendations-section { margin: 30px 0; }
        .recommendation { padding: 15px; margin: 15px 0; border-radius: 5px; }
        .recommendation.success { background: #d4edda; border-left: 4px solid #28a745; }
        .recommendation.high { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation h4 { margin: 0 0 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Performance Test Report</h1>
        <div class="timestamp">Generated on {{timestamp}}</div>
        <h2>Test: {{testName}}</h2>
        
        {{summary}}
        {{metrics}}
        {{charts}}
        {{recommendations}}
        
        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; text-align: center;">
            <p>Generated by InErgize Performance Testing Framework</p>
        </footer>
    </div>
</body>
</html>
    `;
  }

  async writeReport(content) {
    const outputDir = path.dirname(this.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(this.outputFile, content, 'utf8');
  }
}

// Main execution
async function main() {
  const generator = new PerformanceReportGenerator(
    options.testName,
    options.resultsDir,
    options.outputFile,
    thresholds
  );

  const success = await generator.generate();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = PerformanceReportGenerator;