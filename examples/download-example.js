/**
 * PlayClone Download Example
 * Demonstrates download functionality with progress tracking
 */

const { PlayClone } = require('../dist/index');
const path = require('path');

async function downloadExample() {
  console.log('🚀 PlayClone Download Example\n');
  
  const pc = new PlayClone({ 
    headless: false,
    downloadDir: path.join(__dirname, 'downloads')
  });
  
  try {
    // Example 1: Download from GitHub releases
    console.log('📥 Example 1: Downloading from GitHub...');
    await pc.navigate('https://github.com/microsoft/vscode/releases');
    
    // Find and click a download link (e.g., source code zip)
    const downloadResult = await pc.download('a[href*=".zip"]:first-of-type', {
      waitForComplete: true,
      trackProgress: true,
      timeout: 60000
    });
    
    if (downloadResult.success) {
      console.log(`✅ Downloaded: ${downloadResult.fileName}`);
      console.log(`   Path: ${downloadResult.savePath}`);
      console.log(`   Size: ${(downloadResult.size / 1024).toFixed(2)} KB`);
      
      // Get download progress
      const progress = await pc.getDownloadProgress(downloadResult.downloadId);
      if (progress) {
        console.log(`   Status: ${progress.state}`);
        console.log(`   Progress: ${progress.progress}%`);
      }
    } else {
      console.log(`❌ Download failed: ${downloadResult.error}`);
    }
    
    // Example 2: Download with custom filename
    console.log('\n📥 Example 2: Download with custom filename...');
    await pc.navigate('https://www.w3schools.com/html/html5_intro.asp');
    
    // Navigate to a page with downloadable content
    await pc.navigate('https://httpbin.org/image/png');
    
    // This will display an image - let's save it
    const imageResult = await pc.download('https://httpbin.org/image/png', {
      saveAs: 'test-image.png',
      directory: path.join(__dirname, 'images'),
      trackProgress: true
    });
    
    if (imageResult.success) {
      console.log(`✅ Image saved: ${imageResult.fileName}`);
      console.log(`   Path: ${imageResult.savePath}`);
    } else {
      console.log(`❌ Image download failed: ${imageResult.error}`);
    }
    
    // Example 3: Get download statistics
    console.log('\n📊 Download Statistics:');
    const stats = await pc.getDownloadStats();
    if (stats) {
      console.log(`   Total downloads: ${stats.total}`);
      console.log(`   Completed: ${stats.completed}`);
      console.log(`   Failed: ${stats.failed}`);
      console.log(`   Active: ${stats.active}`);
      console.log(`   Total bytes: ${(stats.totalBytes / 1024).toFixed(2)} KB`);
    }
    
    // Example 4: List all downloads
    console.log('\n📋 All Downloads:');
    const allDownloads = await pc.getAllDownloads();
    allDownloads.forEach((dl, index) => {
      console.log(`   ${index + 1}. ${dl.fileName}`);
      console.log(`      State: ${dl.state}`);
      console.log(`      Size: ${(dl.totalBytes / 1024).toFixed(2)} KB`);
      if (dl.endTime) {
        const duration = (dl.endTime - dl.startTime) / 1000;
        console.log(`      Duration: ${duration.toFixed(2)}s`);
      }
    });
    
    // Example 5: Monitor active downloads
    console.log('\n🔄 Active Downloads:');
    const activeDownloads = await pc.getActiveDownloads();
    if (activeDownloads.length === 0) {
      console.log('   No active downloads');
    } else {
      activeDownloads.forEach(dl => {
        console.log(`   - ${dl.fileName}: ${dl.progress}%`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
    console.log('\n✨ Download example completed!');
  }
}

// Run the example
downloadExample().catch(console.error);