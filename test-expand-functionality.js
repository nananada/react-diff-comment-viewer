const { chromium } = require('playwright');

(async () => {
  console.log('=== React Diff Comment Viewer - Expand Functionality Test ===\n');
  
  console.log('Step 1: Launching browser...');
  const browser = await chromium.launch({ headless: false }); // Set to false to see the browser
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Listen for console messages and errors
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    console.log(`[Browser Console ${msg.type()}]:`, text);
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('[Browser Error]:', error.message);
  });
  
  console.log('\nStep 2: Navigating to http://localhost:9000...');
  await page.goto('http://localhost:9000', { waitUntil: 'networkidle' });
  
  // Wait for the page to fully load
  await page.waitForTimeout(2000);
  
  console.log('\nStep 3: Taking initial screenshot...');
  await page.screenshot({ path: 'test-expand-1-initial.png', fullPage: true });
  
  console.log('\nStep 4: Looking for expand buttons...');
  
  // Look for expand buttons with various possible text patterns
  const expandButtonSelectors = [
    'text=/展开.*行/',
    'text=/Expand.*lines/',
    '[class*="codeFold"]',
    '[class*="code-fold"]',
    'button:has-text("展开")',
    'button:has-text("Expand")',
    'a:has-text("展开")',
    'a:has-text("Expand")',
  ];
  
  let expandButtons = [];
  for (const selector of expandButtonSelectors) {
    try {
      const buttons = await page.$$(selector);
      if (buttons.length > 0) {
        console.log(`  Found ${buttons.length} expand button(s) with selector: ${selector}`);
        expandButtons = buttons;
        break;
      }
    } catch (e) {
      // Selector might not be valid, continue
    }
  }
  
  if (expandButtons.length === 0) {
    console.log('  No expand buttons found. Checking page content...');
    
    // Get all text content to see what's on the page
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('\n  Page contains text related to "expand":', 
      pageText.includes('展开') || pageText.includes('Expand') || pageText.includes('lines'));
    
    // Check for any elements with "fold" in their class
    const foldElements = await page.$$('[class*="fold"]');
    console.log(`  Found ${foldElements.length} elements with "fold" in class name`);
    
    if (foldElements.length > 0) {
      // Try to get details about these elements
      for (let i = 0; i < Math.min(foldElements.length, 5); i++) {
        const element = foldElements[i];
        const tagName = await element.evaluate(el => el.tagName);
        const className = await element.evaluate(el => el.className);
        const text = await element.evaluate(el => el.textContent?.substring(0, 100));
        console.log(`    Element ${i + 1}: <${tagName}> class="${className}" text="${text}"`);
      }
    }
  }
  
  console.log('\nStep 5: Attempting to click all expand buttons...');
  let clickCount = 0;
  let clickErrors = [];
  
  if (expandButtons.length > 0) {
    for (let i = 0; i < expandButtons.length; i++) {
      try {
        console.log(`  Clicking expand button ${i + 1}/${expandButtons.length}...`);
        
        // Scroll the button into view
        await expandButtons[i].scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        
        // Get button text before clicking
        const buttonText = await expandButtons[i].evaluate(el => el.textContent);
        console.log(`    Button text: "${buttonText}"`);
        
        // Click the button
        await expandButtons[i].click();
        clickCount++;
        
        // Wait for any animations or content loading
        await page.waitForTimeout(1000);
        
        console.log(`    ✓ Successfully clicked button ${i + 1}`);
      } catch (error) {
        const errorMsg = `Failed to click button ${i + 1}: ${error.message}`;
        console.error(`    ✗ ${errorMsg}`);
        clickErrors.push(errorMsg);
      }
    }
  } else {
    console.log('  No expand buttons to click.');
  }
  
  console.log('\nStep 6: Checking for JavaScript errors...');
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
  
  console.log('\nStep 7: Taking final screenshot after expand...');
  await page.screenshot({ path: 'test-expand-2-after-expand.png', fullPage: true });
  
  console.log('\nStep 8: Analyzing page state...');
  const pageInfo = await page.evaluate(() => {
    return {
      totalLines: document.querySelectorAll('[class*="line"]').length,
      visibleCodeLines: document.querySelectorAll('pre, code').length,
      pageHeight: document.body.scrollHeight,
      foldElements: document.querySelectorAll('[class*="fold"]').length,
    };
  });
  
  console.log('  Page statistics:');
  console.log(`    - Total line elements: ${pageInfo.totalLines}`);
  console.log(`    - Visible code elements: ${pageInfo.visibleCodeLines}`);
  console.log(`    - Page height: ${pageInfo.pageHeight}px`);
  console.log(`    - Fold elements: ${pageInfo.foldElements}`);
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`✓ Expand buttons found: ${expandButtons.length}`);
  console.log(`✓ Expand buttons clicked: ${clickCount}`);
  console.log(`✓ Click errors: ${clickErrors.length}`);
  console.log(`✓ JavaScript errors: ${errors.length}`);
  console.log(`✓ LineNumber-related errors: ${lineNumberErrors.length}`);
  
  if (clickErrors.length > 0) {
    console.log('\nClick Errors:');
    clickErrors.forEach(err => console.log(`  - ${err}`));
  }
  
  if (errors.length > 0) {
    console.log('\nJavaScript Errors:');
    errors.forEach(err => console.log(`  - ${err}`));
  }
  
  console.log('\nScreenshots saved:');
  console.log('  - test-expand-1-initial.png (before expanding)');
  console.log('  - test-expand-2-after-expand.png (after expanding)');
  
  const success = errors.length === 0 && clickErrors.length === 0;
  console.log(`\n${success ? '✅ TEST PASSED' : '❌ TEST FAILED'}: ${
    success 
      ? 'All code expanded successfully without errors!' 
      : 'Errors were detected during the test.'
  }`);
  
  console.log('\nClosing browser in 5 seconds...');
  await page.waitForTimeout(5000);
  await browser.close();
  
  process.exit(success ? 0 : 1);
})().catch(err => {
  console.error('\n❌ FATAL ERROR:', err);
  process.exit(1);
});
