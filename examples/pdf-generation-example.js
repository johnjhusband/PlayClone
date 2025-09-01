#!/usr/bin/env node

/**
 * PDF Generation Example
 * Demonstrates various PDF generation capabilities of PlayClone
 */

const { PlayClone } = require('../dist/index');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log('🎯 PlayClone PDF Generation Example\n');
  
  const pc = new PlayClone({ 
    headless: true,  // Run headless for PDF generation
    viewport: { width: 1280, height: 800 }
  });

  try {
    // Example 1: Generate PDF from a blog article
    console.log('📝 Example 1: Generating PDF from blog article...');
    await pc.navigate('https://blog.mozilla.org/en/');
    
    // Find first article link and navigate to it
    const links = await pc.getLinks();
    if (links.success && links.value.length > 0) {
      const articleUrl = links.value.find(link => 
        link.includes('/blog/') && !link.includes('#')
      );
      if (articleUrl) {
        await pc.navigate(articleUrl);
      }
    }
    
    // Generate PDF with table of contents
    const blogPdf = await pc.generatePdfWithToc({
      format: 'A4',
      printBackground: true,
      outline: true
    });
    
    if (blogPdf.success) {
      const pdfPath = path.join(__dirname, 'blog-article.pdf');
      const buffer = Buffer.from(blogPdf.value.buffer, 'base64');
      await fs.writeFile(pdfPath, buffer);
      console.log(`✅ Blog article saved to: ${pdfPath}`);
      console.log(`   Size: ${blogPdf.value.size} bytes`);
      console.log(`   Pages: ${blogPdf.value.pages}`);
    }

    // Example 2: Generate invoice-style PDF with headers
    console.log('\n📝 Example 2: Generating invoice-style PDF...');
    
    // Navigate to example.com and inject invoice content
    await pc.navigate('https://example.com');
    await pc.execute(`
      document.body.innerHTML = \`
        <div style="padding: 40px; font-family: Arial;">
          <h1>Invoice #12345</h1>
          <p>Date: ${new Date().toLocaleDateString()}</p>
          <hr>
          <h2>Bill To:</h2>
          <p>Acme Corporation<br>123 Main St<br>City, State 12345</p>
          <h2>Items:</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 8px;">Item</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Qty</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Price</th>
              <th style="border: 1px solid #ddd; padding: 8px;">Total</th>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">PlayClone License</td>
              <td style="border: 1px solid #ddd; padding: 8px;">1</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$99.00</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$99.00</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Support Package</td>
              <td style="border: 1px solid #ddd; padding: 8px;">1</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$49.00</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$49.00</td>
            </tr>
          </table>
          <h3 style="text-align: right; margin-top: 20px;">Total: $148.00</h3>
        </div>
      \`;
    `);
    
    // Generate PDF with custom header and footer
    const invoicePdf = await pc.generatePdfWithHeaderFooter(
      { 
        format: 'Letter',
        margin: { top: '1.5in', bottom: '1in', left: '0.5in', right: '0.5in' }
      },
      '<div style="font-size: 12px; text-align: center;">ACME CORPORATION - INVOICE</div>',
      '<div style="font-size: 10px; text-align: center;">Page <span class="pageNumber"></span> | Generated on ' + 
      new Date().toLocaleDateString() + '</div>'
    );
    
    if (invoicePdf.success) {
      const pdfPath = path.join(__dirname, 'invoice.pdf');
      const buffer = Buffer.from(invoicePdf.value.buffer, 'base64');
      await fs.writeFile(pdfPath, buffer);
      console.log(`✅ Invoice saved to: ${pdfPath}`);
      console.log(`   Size: ${invoicePdf.value.size} bytes`);
    }

    // Example 3: Generate print-optimized documentation
    console.log('\n📝 Example 3: Generating print-optimized documentation...');
    await pc.navigate('https://developer.mozilla.org/en-US/docs/Web/API/Document');
    
    // Generate print-optimized PDF (removes interactive elements, adds link URLs)
    const docsPdf = await pc.generatePrintOptimizedPdf({
      format: 'A4',
      scale: 0.9,
      printBackground: false  // Save ink for printing
    });
    
    if (docsPdf.success) {
      const pdfPath = path.join(__dirname, 'documentation.pdf');
      const buffer = Buffer.from(docsPdf.value.buffer, 'base64');
      await fs.writeFile(pdfPath, buffer);
      console.log(`✅ Documentation saved to: ${pdfPath}`);
      console.log(`   Size: ${docsPdf.value.size} bytes`);
      console.log(`   Optimized for printing`);
    }

    // Example 4: Extract specific element as PDF
    console.log('\n📝 Example 4: Extracting specific content as PDF...');
    await pc.navigate('https://github.com/microsoft/playwright');
    
    // Wait for README to load
    await pc.waitFor('.markdown-body', 5000);
    
    // Generate PDF of just the README content
    const readmePdf = await pc.generateElementPdf('.markdown-body', {
      format: 'A4',
      printBackground: true
    });
    
    if (readmePdf.success) {
      const pdfPath = path.join(__dirname, 'readme-only.pdf');
      const buffer = Buffer.from(readmePdf.value.buffer, 'base64');
      await fs.writeFile(pdfPath, buffer);
      console.log(`✅ README content saved to: ${pdfPath}`);
      console.log(`   Size: ${readmePdf.value.size} bytes`);
      console.log(`   Contains only the README section`);
    }

    // Example 5: Multi-format generation
    console.log('\n📝 Example 5: Generating PDFs in multiple formats...');
    await pc.navigate('https://example.com');
    
    const formats = [
      { format: 'A4', name: 'a4-format.pdf' },
      { format: 'Letter', name: 'letter-format.pdf' },
      { format: 'A5', landscape: true, name: 'a5-landscape.pdf' }
    ];
    
    for (const config of formats) {
      const result = await pc.savePdf(
        path.join(__dirname, config.name),
        { format: config.format, landscape: config.landscape }
      );
      
      if (result.success) {
        console.log(`✅ Generated ${config.name} (${config.format}${config.landscape ? ' landscape' : ''})`);
      }
    }

    console.log('\n✨ PDF Generation Examples Complete!');
    console.log('📁 Check the examples directory for generated PDFs');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pc.close();
  }
}

// Run the examples
main().catch(console.error);