#!/usr/bin/env node

// Simple screenshot script using Chrome DevTools Protocol
const CDP = require('chrome-remote-interface');
const { spawn } = require('child_process');
const fs = require('fs');

let chrome;

async function launchChrome() {
  return new Promise((resolve, reject) => {
    // Try to launch Chrome in headless mode
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      'google-chrome',
      'chromium',
      'chromium-browser'
    ];
    
    let chromePath = null;
    for (const path of chromePaths) {
      if (fs.existsSync(path)) {
        chromePath = path;
        break;
      }
    }
    
    if (!chromePath) {
      chromePath = 'google-chrome'; // Try system PATH
    }
    
    console.log('Launching Chrome from:', chromePath);
    chrome = spawn(chromePath, [
      '--headless',
      '--disable-gpu',
      '--remote-debugging-port=9222',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]);
    
    chrome.on('error', reject);
    
    // Wait a bit for Chrome to start
    setTimeout(() => resolve(), 2000);
  });
}

async function takeScreenshots() {
  try {
    console.log('Launching Chrome...');
    await launchChrome();
    
    console.log('Connecting to Chrome DevTools Protocol...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    console.log('Navigating to http://localhost:9000...');
    await Page.navigate({ url: 'http://localhost:9000' });
    await Page.loadEventFired();
    
    // Wait for page to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Screenshot 1: Top of page
    console.log('Taking screenshot 1: Top of page...');
    const screenshot1 = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshot-1-top.png', Buffer.from(screenshot1.data, 'base64'));
    
    // Screenshot 2: Scroll to line 92-96
    console.log('Taking screenshot 2: Lines 92-96...');
    await Runtime.evaluate({ expression: 'window.scrollBy(0, 2200)' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const screenshot2 = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshot-2-lines-92-96.png', Buffer.from(screenshot2.data, 'base64'));
    
    // Screenshot 3: Bottom of page
    console.log('Taking screenshot 3: Bottom of page (line 470)...');
    await Runtime.evaluate({ expression: 'window.scrollTo(0, document.body.scrollHeight)' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const screenshot3 = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshot-3-bottom-line-470.png', Buffer.from(screenshot3.data, 'base64'));
    
    console.log('All screenshots taken successfully!');
    console.log('Files created:');
    console.log('  - screenshot-1-top.png');
    console.log('  - screenshot-2-lines-92-96.png');
    console.log('  - screenshot-3-bottom-line-470.png');
    
    await client.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    if (chrome) {
      chrome.kill();
    }
  }
}

takeScreenshots();
