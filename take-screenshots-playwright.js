const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  console.log('Navigating to http://localhost:9000...');
  await page.goto('http://localhost:9000', { waitUntil: 'networkidle' });
  
  // Wait a bit for any animations
  await page.waitForTimeout(2000);
  
  // Screenshot 1: Top of the page
  console.log('Taking screenshot 1: Top of page...');
  await page.screenshot({ 
    path: 'screenshot-1-top.png'
  });
  
  // Screenshot 2: Scroll to around row 94 (lines 92-96)
  console.log('Taking screenshot 2: Lines 92-96...');
  // Scroll down approximately to line 92-96 area
  await page.evaluate(() => window.scrollBy(0, 2200));
  await page.waitForTimeout(1000);
  await page.screenshot({ 
    path: 'screenshot-2-lines-92-96.png'
  });
  
  // Screenshot 3: Bottom of the page (line 470)
  console.log('Taking screenshot 3: Bottom of page (line 470)...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ 
    path: 'screenshot-3-bottom-line-470.png'
  });
  
  console.log('All screenshots taken!');
  console.log('Files created:');
  console.log('  - screenshot-1-top.png');
  console.log('  - screenshot-2-lines-92-96.png');
  console.log('  - screenshot-3-bottom-line-470.png');
  
  await browser.close();
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
