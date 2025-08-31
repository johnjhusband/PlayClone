#!/bin/bash

# PlayClone Comprehensive Stress Testing Script
# Runs all stress tests and generates a combined report

echo "🔥 PlayClone Comprehensive Stress Testing Suite"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create results directory
RESULTS_DIR="stress-test-results"
mkdir -p $RESULTS_DIR

# Timestamp for this test run
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$RESULTS_DIR/stress-test-report-$TIMESTAMP.txt"

# Initialize report
echo "PlayClone Stress Test Report - $TIMESTAMP" > $REPORT_FILE
echo "==========================================" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Function to run a test and capture results
run_test() {
    local test_name=$1
    local test_command=$2
    local test_description=$3
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "$test_description"
    echo "----------------------------------------"
    
    echo "## $test_name" >> $REPORT_FILE
    echo "$test_description" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    
    # Run the test and capture output
    if $test_command >> $REPORT_FILE 2>&1; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        echo "Result: PASSED" >> $REPORT_FILE
        return 0
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        echo "Result: FAILED" >> $REPORT_FILE
        return 1
    fi
    
    echo "" >> $REPORT_FILE
    echo "----------------------------------------" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
}

# Track overall results
TOTAL_TESTS=0
PASSED_TESTS=0

# Test 1: Quick Concurrent Test
echo "📊 Phase 1: Quick Validation Tests"
echo "=================================="
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Quick Concurrent Test" \
    "node tests/performance/concurrent-operations-test.js --quick" \
    "Validates basic concurrent operation capability (10 simultaneous browsers)"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 2: Memory Profile Test
echo "📊 Phase 2: Memory and Performance Tests"
echo "========================================"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Memory Profile Test" \
    "node tests/performance/memory-profiler-simple.js" \
    "Profiles memory usage patterns and checks for leaks"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 3: Heavy Load Test
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Heavy Load Test" \
    "node tests/performance/heavy-load-test.js" \
    "Tests system under heavy load (10 parallel browsers, 100 operations)"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 4: Continuous Load Test (Short Duration)
echo "📊 Phase 3: Continuous Load Tests"
echo "================================="
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Continuous Load Test (1 minute)" \
    "node tests/performance/continuous-load-test.js --duration 60 --concurrency 5" \
    "Runs continuous load for 1 minute to detect memory leaks"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 5: 100+ Concurrent Operations
echo "📊 Phase 4: Extreme Concurrency Tests"
echo "====================================="
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "100+ Concurrent Operations Test" \
    "node tests/performance/concurrent-operations-test.js" \
    "Tests 100+ simultaneous browser operations"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi

echo ""

# Test 6: Full Stress Test Suite (if not in CI mode)
if [ "$1" != "--ci" ]; then
    echo "📊 Phase 5: Comprehensive Stress Test"
    echo "====================================="
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if run_test "Comprehensive Stress Test" \
        "node --expose-gc tests/performance/stress-test-suite.js" \
        "Full stress test with increasing concurrency levels (10-150 browsers)"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
else
    echo "Skipping comprehensive stress test in CI mode"
fi

echo ""
echo "==========================================="
echo "📊 FINAL RESULTS"
echo "==========================================="
echo ""

# Calculate success rate
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo "Tests Passed: $PASSED_TESTS / $TOTAL_TESTS"
echo "Success Rate: $SUCCESS_RATE%"
echo ""

# Write summary to report
echo "" >> $REPORT_FILE
echo "## SUMMARY" >> $REPORT_FILE
echo "Tests Passed: $PASSED_TESTS / $TOTAL_TESTS" >> $REPORT_FILE
echo "Success Rate: $SUCCESS_RATE%" >> $REPORT_FILE
echo "Report Generated: $(date)" >> $REPORT_FILE

# Display report location
echo "📄 Full report saved to: $REPORT_FILE"
echo ""

# Generate HTML report if all tests pass
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}✅ ALL STRESS TESTS PASSED!${NC}"
    
    # Create a simple HTML report
    HTML_REPORT="$RESULTS_DIR/stress-test-report-$TIMESTAMP.html"
    cat > $HTML_REPORT << EOF
<!DOCTYPE html>
<html>
<head>
    <title>PlayClone Stress Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2e7d32; }
        .pass { color: green; font-weight: bold; }
        .summary { background: #e8f5e9; padding: 20px; border-radius: 5px; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>PlayClone Stress Test Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p class="pass">✅ ALL TESTS PASSED</p>
        <p>Tests: $PASSED_TESTS / $TOTAL_TESTS</p>
        <p>Success Rate: 100%</p>
        <p>Generated: $(date)</p>
    </div>
    <h2>Test Details</h2>
    <pre>$(cat $REPORT_FILE)</pre>
</body>
</html>
EOF
    echo "📄 HTML report generated: $HTML_REPORT"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo "Please review the report for details."
    exit 1
fi