const CDP = require('chrome-remote-interface');
const { spawn } = require('child_process');

let chrome = null;

async function launchChrome() {
  // Launch Chrome with remote debugging enabled
  chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/chrome-test-profile',
    'http://localhost:9000'
  ], {
    stdio: 'ignore',
    detached: true
  });
  
  // Wait for Chrome to start
  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function runTest() {
  console.log('=== React Diff Comment Viewer - Expand Functionality Test ===\n');
  
  try {
    console.log('Step 1: Launching Chrome with remote debugging...');
    await launchChrome();
    
    console.log('Step 2: Connecting to Chrome DevTools Protocol...');
    const client = await CDP({ port: 9222 });
    
    const { Network, Page, Runtime, Console } = client;
    
    // Enable necessary domains
    await Network.enable();
    await Page.enable();
    await Runtime.enable();
    await Console.enable();
    
    const errors = [];
    const consoleMessages = [];
    
    // Listen for console messages
    Console.messageAdded(({ message }) => {
      const msg = `[${message.level}] ${message.text}`;
      consoleMessages.push(msg);
      console.log(`  Browser Console: ${msg}`);
    });
    
    // Listen for JavaScript errors
    Runtime.exceptionThrown(({ exceptionDetails }) => {
      const error = exceptionDetails.exception?.description || exceptionDetails.text;
      errors.push(error);
      console.error(`  ❌ JavaScript Error: ${error}`);
    });
    
    console.log('\nStep 3: Navigating to http://localhost:9000...');
    await Page.navigate({ url: 'http://localhost:9000' });
    await Page.loadEventFired();
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\nStep 4: Looking for expand buttons...');
    
    // Execute JavaScript to find and click expand buttons
    const result = await Runtime.evaluate({
      expression: `
        (function() {
          const results = {
            expandButtons: [],
            clickedButtons: 0,
            clickErrors: [],
            pageInfo: {}
          };
          
          // Find all elements that might be expand buttons
          const allElements = document.querySelectorAll('*');
          const expandButtons = [];
          
          allElements.forEach(el => {
            const text = el.textContent || '';
            if (text.includes('展开') || text.includes('Expand') || text.includes('lines')) {
              const tagName = el.tagName.toLowerCase();
              if (tagName === 'td' || tagName === 'a' || tagName === 'button' || tagName === 'span') {
                expandButtons.push({
                  tag: tagName,
                  text: text.substring(0, 100),
                  className: el.className
                });
              }
            }
          });
          
          results.expandButtons = expandButtons;
          
          // Try to click expand buttons
          expandButtons.forEach((btnInfo, index) => {
            try {
              // Find the actual element again and click it
              const elements = Array.from(document.querySelectorAll(btnInfo.tag));
              const element = elements.find(el => 
                (el.textContent || '').substring(0, 100) === btnInfo.text
              );
              
              if (element) {
                element.click();
                results.clickedButtons++;
              }
            } catch (error) {
              results.clickErrors.push(\`Button \${index + 1}: \${error.message}\`);
            }
          });
          
          // Get page info
          results.pageInfo = {
            totalElements: document.querySelectorAll('*').length,
            codeLines: document.querySelectorAll('pre, code, [class*="line"]').length,
            pageHeight: document.body.scrollHeight
          };
          
          return results;
        })()
      `,
      returnByValue: true
    });
    
    const testResults = result.result.value;
    
    console.log(`\n  Found ${testResults.expandButtons.length} potential expand button(s):`);
    testResults.expandButtons.forEach((btn, i) => {
      console.log(`    ${i + 1}. <${btn.tag}> class="${btn.className}" text="${btn.text}"`);
    });
    
    console.log(`\n  Clicked ${testResults.clickedButtons} button(s)`);
    
    if (testResults.clickErrors.length > 0) {
      console.log(`\n  Click errors:`);
      testResults.clickErrors.forEach(err => console.log(`    - ${err}`));
    }
    
    // Wait for any animations or updates
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\nStep 5: Checking for JavaScript errors...');
    const lineNumberErrors = errors.filter(err => 
      err.includes('lineNumber') || err.includes('line number')
    );
    
    if (lineNumberErrors.length > 0) {
      console.log('  ⚠️  Found lineNumber-related errors:');
      lineNumberErrors.forEach(err => console.log(`    - ${err}`));
    } else if (errors.length > 0) {
      console.log('  ⚠️  Found other JavaScript errors:');
      errors.forEach(err => console.log(`    - ${err}`));
    } else {
      console.log('  ✓ No JavaScript errors detected!');
    }
    
    console.log('\nStep 6: Page statistics:');
    console.log(`  - Total elements: ${testResults.pageInfo.totalElements}`);
    console.log(`  - Code line elements: ${testResults.pageInfo.codeLines}`);
    console.log(`  - Page height: ${testResults.pageInfo.pageHeight}px`);
    
    console.log('\n=== TEST RESULTS ===');
    console.log(`✓ Expand buttons found: ${testResults.expandButtons.length}`);
    console.log(`✓ Expand buttons clicked: ${testResults.clickedButtons}`);
    console.log(`✓ Click errors: ${testResults.clickErrors.length}`);
    console.log(`✓ JavaScript errors: ${errors.length}`);
    console.log(`✓ LineNumber-related errors: ${lineNumberErrors.length}`);
    
    const success = errors.length === 0 && testResults.clickErrors.length === 0;
    console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}: ${
      success 
        ? 'All code expanded successfully without errors!' 
        : 'Errors were detected during the test.'
    }`);
    
    await client.close();
    
    // Keep Chrome open for manual inspection
    console.log('\nChrome will remain open for manual inspection.');
    console.log('Press Ctrl+C to close this script (Chrome will continue running).');
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    
    if (chrome) {
      chrome.kill();
    }
    
    process.exit(1);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\nTest script terminated. Chrome may still be running.');
  process.exit(0);
});

runTest();
