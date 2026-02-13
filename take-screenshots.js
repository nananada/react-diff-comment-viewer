const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Navigating to http://localhost:9000...');
  await page.goto('http://localhost:9000', { waitUntil: 'networkidle0' });
  
  // Wait a bit for any animations
  await page.waitForTimeout(2000);
  
  // Screenshot 1: Top of the page
  console.log('Taking screenshot 1: Top of page...');
  await page.screenshot({ 
    path: 'screenshot-1-top.png',
    fullPage: false 
  });
  
  // Screenshot 2: Scroll to around row 94 (lines 92-96)
  console.log('Taking screenshot 2: Lines 92-96...');
  // Try to find the line element and scroll to it
  try {
    // Look for line 92 or 94 in the diff viewer
    const lineElement = await page.$('[data-line-number="92"], [data-line-number="94"]');
    if (lineElement) {
      await lineElement.scrollIntoView({ block: 'center' });
    } else {
      // Fallback: scroll by pixels
      await page.evaluate(() => window.scrollBy(0, 2000));
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshot-2-lines-92-96.png',
      fullPage: false 
    });
  } catch (e) {
    console.log('Could not find specific line, scrolling by estimate');
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshot-2-lines-92-96.png',
      fullPage: false 
    });
  }
  
  // Screenshot 3: Bottom of the page (line 470)
  console.log('Taking screenshot 3: Bottom of page (line 470)...');
  try {
    // Try to find line 470
    const lastLine = await page.$('[data-line-number="470"]');
    if (lastLine) {
      await lastLine.scrollIntoView({ block: 'center' });
    } else {
      // Fallback: scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshot-3-bottom-line-470.png',
      fullPage: false 
    });
  } catch (e) {
    console.log('Could not find line 470, scrolling to bottom');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'screenshot-3-bottom-line-470.png',
      fullPage: false 
    });
  }
  
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
