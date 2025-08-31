import { BasePlugin } from '../../src/plugins/BasePlugin';
import { PluginMetadata, PluginContext } from '../../src/plugins/PluginManager';
import { Page } from 'playwright-core';

/**
 * SEO Analyzer Plugin for PlayClone
 * Analyzes web pages for SEO best practices and issues
 */
export class SEOAnalyzerPlugin extends BasePlugin {
  metadata: PluginMetadata = {
    name: 'seo-analyzer',
    version: '1.0.0',
    description: 'Analyzes pages for SEO optimization and provides recommendations',
    author: 'PlayClone Team',
    keywords: ['seo', 'analysis', 'optimization', 'meta-tags'],
    license: 'MIT'
  };

  async onLoad(context: PluginContext): Promise<void> {
    await super.onLoad(context);
    
    // Register commands
    this.registerCommand('analyzeSEO', this.analyzeSEO.bind(this));
    this.registerCommand('checkMeta', this.checkMetaTags.bind(this));
    this.registerCommand('analyzeHeaders', this.analyzeHeaders.bind(this));
    this.registerCommand('checkImages', this.checkImages.bind(this));
    this.registerCommand('analyzeLinks', this.analyzeLinks.bind(this));
    
    // Register extractors
    this.registerExtractor('seo-data', this.extractSEOData.bind(this));
    
    context.logger.info('SEO Analyzer plugin loaded');
  }

  async onAfterNavigate(url: string, context: PluginContext): Promise<void> {
    // Auto-analyze if configured
    if (context.config.settings?.autoAnalyze) {
      const analysis = await this.performSEOAnalysis(context.page!);
      context.logger.info('SEO Analysis:', analysis.score);
    }
  }

  private async analyzeSEO(args: any, context: PluginContext): Promise<any> {
    if (!context.page) {
      throw new Error('No active page for SEO analysis');
    }
    
    return await this.performSEOAnalysis(context.page);
  }

  private async performSEOAnalysis(page: Page): Promise<any> {
    const [meta, headers, images, links, content] = await Promise.all([
      this.checkMetaTags({ detailed: true }, { page } as any),
      this.analyzeHeaders({}, { page } as any),
      this.checkImages({}, { page } as any),
      this.analyzeLinks({}, { page } as any),
      this.analyzeContent(page)
    ]);
    
    // Calculate SEO score
    const issues: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];
    
    // Meta tag checks
    if (!meta.title) issues.push('Missing title tag');
    else if (meta.title.length < 30) warnings.push('Title too short (< 30 chars)');
    else if (meta.title.length > 60) warnings.push('Title too long (> 60 chars)');
    else passes.push('Title tag present and optimal length');
    
    if (!meta.description) issues.push('Missing meta description');
    else if (meta.description.length < 120) warnings.push('Meta description too short');
    else if (meta.description.length > 160) warnings.push('Meta description too long');
    else passes.push('Meta description present and optimal length');
    
    if (!meta.viewport) issues.push('Missing viewport meta tag');
    else passes.push('Viewport meta tag present');
    
    // Header checks
    if (headers.h1Count === 0) issues.push('No H1 tag found');
    else if (headers.h1Count > 1) warnings.push('Multiple H1 tags found');
    else passes.push('Single H1 tag present');
    
    if (!headers.properHierarchy) warnings.push('Improper heading hierarchy');
    else passes.push('Proper heading hierarchy');
    
    // Image checks
    if (images.missingAlt > 0) {
      issues.push(`${images.missingAlt} images missing alt text`);
    } else {
      passes.push('All images have alt text');
    }
    
    if (images.largeSizeCount > 0) {
      warnings.push(`${images.largeSizeCount} large images that may affect performance`);
    }
    
    // Link checks
    if (links.brokenCount > 0) {
      issues.push(`${links.brokenCount} broken links found`);
    }
    
    if (links.externalNoFollow < links.externalCount * 0.5) {
      warnings.push('Consider adding rel="nofollow" to external links');
    }
    
    // Content checks
    if (content.wordCount < 300) {
      warnings.push('Content too short (< 300 words)');
    } else {
      passes.push(`Good content length (${content.wordCount} words)`);
    }
    
    // Calculate score
    const totalChecks = issues.length + warnings.length + passes.length;
    const score = Math.round((passes.length / totalChecks) * 100);
    
    return {
      score,
      grade: this.getGrade(score),
      summary: {
        issues: issues.length,
        warnings: warnings.length,
        passes: passes.length
      },
      details: {
        issues,
        warnings,
        passes
      },
      meta,
      headers,
      images,
      links,
      content,
      recommendations: this.generateRecommendations(issues, warnings)
    };
  }

  private async checkMetaTags(args: any, context: PluginContext): Promise<any> {
    const page = context.page;
    if (!page) throw new Error('No page available');
    
    const metaTags = await page.evaluate(() => {
      const getMeta = (name: string): string | null => {
        const tag = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return tag ? tag.getAttribute('content') : null;
      };
      
      const title = document.title;
      const description = getMeta('description');
      const keywords = getMeta('keywords');
      const viewport = getMeta('viewport');
      const robots = getMeta('robots');
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      
      // Open Graph tags
      const ogTitle = getMeta('og:title');
      const ogDescription = getMeta('og:description');
      const ogImage = getMeta('og:image');
      const ogUrl = getMeta('og:url');
      
      // Twitter Card tags
      const twitterCard = getMeta('twitter:card');
      const twitterTitle = getMeta('twitter:title');
      const twitterDescription = getMeta('twitter:description');
      const twitterImage = getMeta('twitter:image');
      
      return {
        title,
        titleLength: title ? title.length : 0,
        description,
        descriptionLength: description ? description.length : 0,
        keywords,
        viewport,
        robots,
        canonical,
        openGraph: {
          title: ogTitle,
          description: ogDescription,
          image: ogImage,
          url: ogUrl
        },
        twitter: {
          card: twitterCard,
          title: twitterTitle,
          description: twitterDescription,
          image: twitterImage
        }
      };
    });
    
    if (args.detailed) {
      return metaTags;
    }
    
    return {
      title: metaTags.title,
      description: metaTags.description,
      hasOpenGraph: !!(metaTags.openGraph.title && metaTags.openGraph.description),
      hasTwitterCard: !!(metaTags.twitter.card && metaTags.twitter.title)
    };
  }

  private async analyzeHeaders(args: any, context: PluginContext): Promise<any> {
    const page = context.page;
    if (!page) throw new Error('No page available');
    
    const headers = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1');
      const h2s = document.querySelectorAll('h2');
      const h3s = document.querySelectorAll('h3');
      const h4s = document.querySelectorAll('h4');
      const h5s = document.querySelectorAll('h5');
      const h6s = document.querySelectorAll('h6');
      
      // Check hierarchy
      let properHierarchy = true;
      const allHeaders = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let lastLevel = 0;
      
      for (const header of allHeaders) {
        const level = parseInt(header.tagName[1]);
        if (level > lastLevel + 1) {
          properHierarchy = false;
          break;
        }
        lastLevel = level;
      }
      
      return {
        h1Count: h1s.length,
        h2Count: h2s.length,
        h3Count: h3s.length,
        h4Count: h4s.length,
        h5Count: h5s.length,
        h6Count: h6s.length,
        totalHeaders: allHeaders.length,
        properHierarchy,
        h1Text: Array.from(h1s).map(h => h.textContent?.trim()).filter(Boolean)
      };
    });
    
    return headers;
  }

  private async checkImages(args: any, context: PluginContext): Promise<any> {
    const page = context.page;
    if (!page) throw new Error('No page available');
    
    const imageAnalysis = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      let missingAlt = 0;
      let emptyAlt = 0;
      let largeSizeCount = 0;
      const imageData: any[] = [];
      
      for (const img of images) {
        const alt = img.getAttribute('alt');
        const src = img.getAttribute('src');
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        
        if (alt === null) missingAlt++;
        else if (alt === '') emptyAlt++;
        
        // Consider images > 200KB as large (estimated)
        if (width * height > 500000) largeSizeCount++;
        
        imageData.push({
          src,
          alt,
          width,
          height,
          loading: img.loading,
          decoding: img.decoding
        });
      }
      
      return {
        totalImages: images.length,
        missingAlt,
        emptyAlt,
        largeSizeCount,
        lazyLoadCount: images.filter(img => img.loading === 'lazy').length,
        images: imageData.slice(0, 10) // Return first 10 for analysis
      };
    });
    
    return imageAnalysis;
  }

  private async analyzeLinks(args: any, context: PluginContext): Promise<any> {
    const page = context.page;
    if (!page) throw new Error('No page available');
    
    const linkAnalysis = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const currentHost = window.location.host;
      
      let internalCount = 0;
      let externalCount = 0;
      let externalNoFollow = 0;
      let brokenCount = 0;
      let hashLinks = 0;
      
      const linkData: any[] = [];
      
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const rel = link.getAttribute('rel') || '';
        const text = link.textContent?.trim() || '';
        
        if (href.startsWith('#')) {
          hashLinks++;
        } else if (href.startsWith('http://') || href.startsWith('https://')) {
          const url = new URL(href);
          if (url.host === currentHost) {
            internalCount++;
          } else {
            externalCount++;
            if (rel.includes('nofollow')) {
              externalNoFollow++;
            }
          }
        } else if (href.startsWith('/') || !href.includes(':')) {
          internalCount++;
        }
        
        // Check for potentially broken links
        if (href === '' || href === '#' || href === 'javascript:void(0)') {
          brokenCount++;
        }
        
        linkData.push({
          href,
          text: text.substring(0, 50),
          rel,
          target: link.target
        });
      }
      
      return {
        totalLinks: links.length,
        internalCount,
        externalCount,
        externalNoFollow,
        brokenCount,
        hashLinks,
        links: linkData.slice(0, 20) // Return first 20 for analysis
      };
    });
    
    return linkAnalysis;
  }

  private async analyzeContent(page: Page): Promise<any> {
    const content = await page.evaluate(() => {
      // Get main content text
      const body = document.body;
      const text = body ? body.innerText : '';
      
      // Count words
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const wordCount = words.length;
      
      // Calculate reading time (average 200 words per minute)
      const readingTime = Math.ceil(wordCount / 200);
      
      // Check for structured data
      const structuredData = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      ).length > 0;
      
      return {
        wordCount,
        readingTime,
        structuredData,
        hasSchema: structuredData
      };
    });
    
    return content;
  }

  private async extractSEOData(page: Page, options?: any): Promise<any> {
    return await this.performSEOAnalysis(page);
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendations(issues: string[], warnings: string[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.includes('Missing title tag')) {
      recommendations.push('Add a unique, descriptive title tag (30-60 characters)');
    }
    
    if (issues.includes('Missing meta description')) {
      recommendations.push('Add a compelling meta description (120-160 characters)');
    }
    
    if (issues.includes('No H1 tag found')) {
      recommendations.push('Add a single H1 tag with your main keyword');
    }
    
    if (issues.some(i => i.includes('images missing alt text'))) {
      recommendations.push('Add descriptive alt text to all images for accessibility and SEO');
    }
    
    if (warnings.includes('Content too short (< 300 words)')) {
      recommendations.push('Increase content length to at least 300-500 words for better SEO');
    }
    
    if (issues.some(i => i.includes('broken links'))) {
      recommendations.push('Fix or remove broken links to improve user experience');
    }
    
    return recommendations;
  }
}

export default SEOAnalyzerPlugin;