import { Page } from 'playwright-core';
import crypto from 'crypto';

interface PageSnapshot {
  url: string;
  timestamp: Date;
  domHash: string;
  elementCount: number;
  textContent: string;
  structure: PageStructure;
  criticalElements: ElementSignature[];
  interactiveElements: number;
  formElements: number;
  linkCount: number;
  imageCount: number;
}

interface PageStructure {
  depth: number;
  nodeTypes: Map<string, number>;
  classPatterns: string[];
  idPatterns: string[];
  dataAttributes: string[];
}

interface ElementSignature {
  selector: string;
  hash: string;
  type: string;
  attributes: Record<string, string>;
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
  text?: string;
}

interface ChangeDetectionResult {
  hasChanged: boolean;
  changeScore: number;
  changes: PageChange[];
  adaptations: AdaptationStrategy[];
  confidence: number;
}

interface PageChange {
  type: 'added' | 'removed' | 'modified' | 'moved' | 'resized';
  element?: ElementSignature;
  oldValue?: any;
  newValue?: any;
  impact: 'critical' | 'major' | 'minor' | 'cosmetic';
}

interface AdaptationStrategy {
  type: string;
  description: string;
  apply: () => Promise<void>;
  priority: number;
}

export class PageChangeDetector {
  private snapshots: Map<string, PageSnapshot[]> = new Map();
  private adaptationHistory: Map<string, AdaptationStrategy[]> = new Map();
  private maxSnapshotsPerUrl = 10;
  private changeThreshold = 0.3;
  private criticalSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'a[href*="login"]',
    'a[href*="signin"]',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    '[role="button"]',
    'form',
    'nav',
    '[role="navigation"]',
    'main',
    '[role="main"]'
  ];

  async captureSnapshot(page: Page): Promise<PageSnapshot> {
    const url = page.url();
    const timestamp = new Date();

    const snapshot = await page.evaluate((criticalSelectors) => {
      const getElementSignature = (element: Element): any => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        
        const attributes: Record<string, string> = {};
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          if (!attr.name.startsWith('data-react') && !attr.name.startsWith('_')) {
            attributes[attr.name] = attr.value;
          }
        }

        return {
          selector: element.tagName.toLowerCase() + 
                   (element.id ? `#${element.id}` : '') +
                   (element.className ? `.${element.className.split(' ')[0]}` : ''),
          hash: '',
          type: element.tagName.toLowerCase(),
          attributes,
          position: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          visible: styles.display !== 'none' && 
                  styles.visibility !== 'hidden' && 
                  rect.width > 0 && 
                  rect.height > 0,
          text: element.textContent?.trim().substring(0, 100)
        };
      };

      const analyzeStructure = (): any => {
        const nodeTypes = new Map<string, number>();
        const classPatterns: Set<string> = new Set();
        const idPatterns: Set<string> = new Set();
        const dataAttributes: Set<string> = new Set();
        let maxDepth = 0;

        const traverse = (node: Element, depth: number) => {
          maxDepth = Math.max(maxDepth, depth);
          const tagName = node.tagName.toLowerCase();
          nodeTypes.set(tagName, (nodeTypes.get(tagName) || 0) + 1);

          if (node.className && typeof node.className === 'string') {
            const classes = node.className.split(' ');
            classes.forEach(c => {
              const pattern = c.replace(/\d+/g, 'N').replace(/[a-f0-9]{8,}/g, 'HASH');
              if (pattern.length > 2) {
                classPatterns.add(pattern);
              }
            });
          }

          if (node.id) {
            const pattern = node.id.replace(/\d+/g, 'N').replace(/[a-f0-9]{8,}/g, 'HASH');
            if (pattern.length > 2) {
              idPatterns.add(pattern);
            }
          }

          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            if (attr.name.startsWith('data-')) {
              dataAttributes.add(attr.name);
            }
          }

          for (let i = 0; i < node.children.length; i++) {
            traverse(node.children[i], depth + 1);
          }
        };

        traverse(document.body, 0);

        return {
          depth: maxDepth,
          nodeTypes: Array.from(nodeTypes.entries()),
          classPatterns: Array.from(classPatterns).slice(0, 50),
          idPatterns: Array.from(idPatterns).slice(0, 50),
          dataAttributes: Array.from(dataAttributes).slice(0, 50)
        };
      };

      const criticalElements: any[] = [];
      for (const selector of criticalSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            criticalElements.push(getElementSignature(el));
          });
        } catch (e) {
          console.log(`Failed to query selector: ${selector}`);
        }
      }

      const allElements = document.querySelectorAll('*');
      const interactiveElements = document.querySelectorAll(
        'button, a, input, select, textarea, [role="button"], [onclick]'
      ).length;
      const formElements = document.querySelectorAll(
        'form, input, select, textarea, button[type="submit"]'
      ).length;
      const linkCount = document.querySelectorAll('a[href]').length;
      const imageCount = document.querySelectorAll('img').length;

      const textContent = document.body.innerText || '';
      const domContent = document.documentElement.outerHTML;

      return {
        elementCount: allElements.length,
        textContent: textContent.substring(0, 1000),
        structure: analyzeStructure(),
        criticalElements,
        interactiveElements,
        formElements,
        linkCount,
        imageCount,
        domContent
      };
    }, this.criticalSelectors);

    const domHash = crypto
      .createHash('sha256')
      .update(snapshot.domContent || '')
      .digest('hex');

    delete (snapshot as any).domContent;

    for (const element of snapshot.criticalElements) {
      element.hash = crypto
        .createHash('md5')
        .update(JSON.stringify({
          type: element.type,
          attributes: element.attributes,
          text: element.text
        }))
        .digest('hex');
    }

    const structure: PageStructure = {
      depth: snapshot.structure.depth,
      nodeTypes: new Map(snapshot.structure.nodeTypes),
      classPatterns: snapshot.structure.classPatterns,
      idPatterns: snapshot.structure.idPatterns,
      dataAttributes: snapshot.structure.dataAttributes
    };

    const finalSnapshot: PageSnapshot = {
      url,
      timestamp,
      domHash,
      elementCount: snapshot.elementCount,
      textContent: snapshot.textContent,
      structure,
      criticalElements: snapshot.criticalElements,
      interactiveElements: snapshot.interactiveElements,
      formElements: snapshot.formElements,
      linkCount: snapshot.linkCount,
      imageCount: snapshot.imageCount
    };

    this.storeSnapshot(url, finalSnapshot);
    return finalSnapshot;
  }

  async detectChanges(
    page: Page,
    referenceSnapshot?: PageSnapshot
  ): Promise<ChangeDetectionResult> {
    const currentSnapshot = await this.captureSnapshot(page);
    const url = page.url();

    if (!referenceSnapshot) {
      const history = this.snapshots.get(url);
      if (!history || history.length === 0) {
        return {
          hasChanged: false,
          changeScore: 0,
          changes: [],
          adaptations: [],
          confidence: 1.0
        };
      }
      referenceSnapshot = history[history.length - 1];
    }

    const changes: PageChange[] = [];
    let changeScore = 0;

    if (currentSnapshot.domHash !== referenceSnapshot.domHash) {
      const structuralChanges = this.detectStructuralChanges(
        referenceSnapshot,
        currentSnapshot
      );
      changes.push(...structuralChanges);
      changeScore += structuralChanges.length * 0.1;
    }

    const elementChanges = this.detectElementChanges(
      referenceSnapshot.criticalElements,
      currentSnapshot.criticalElements
    );
    changes.push(...elementChanges);
    
    for (const change of elementChanges) {
      if (change.impact === 'critical') changeScore += 0.3;
      else if (change.impact === 'major') changeScore += 0.2;
      else if (change.impact === 'minor') changeScore += 0.1;
    }

    const contentChange = this.calculateTextSimilarity(
      referenceSnapshot.textContent,
      currentSnapshot.textContent
    );
    if (contentChange < 0.7) {
      changes.push({
        type: 'modified',
        impact: contentChange < 0.3 ? 'major' : 'minor',
        oldValue: referenceSnapshot.textContent.substring(0, 100),
        newValue: currentSnapshot.textContent.substring(0, 100)
      });
      changeScore += (1 - contentChange) * 0.2;
    }

    const hasChanged = changeScore > this.changeThreshold;
    const adaptations = hasChanged ? 
      await this.generateAdaptations(page, changes, currentSnapshot) : [];

    return {
      hasChanged,
      changeScore: Math.min(1.0, changeScore),
      changes,
      adaptations,
      confidence: this.calculateConfidence(changes, changeScore)
    };
  }

  private detectStructuralChanges(
    oldSnapshot: PageSnapshot,
    newSnapshot: PageSnapshot
  ): PageChange[] {
    const changes: PageChange[] = [];

    const elementDiff = Math.abs(newSnapshot.elementCount - oldSnapshot.elementCount);
    if (elementDiff > oldSnapshot.elementCount * 0.2) {
      changes.push({
        type: 'modified',
        impact: 'major',
        oldValue: oldSnapshot.elementCount,
        newValue: newSnapshot.elementCount
      });
    }

    const oldNodeTypes = oldSnapshot.structure.nodeTypes;
    const newNodeTypes = newSnapshot.structure.nodeTypes;
    
    for (const [tag, count] of oldNodeTypes) {
      const newCount = newNodeTypes.get(tag) || 0;
      if (Math.abs(newCount - count) > count * 0.3) {
        changes.push({
          type: newCount > count ? 'added' : 'removed',
          impact: 'minor',
          oldValue: { tag, count },
          newValue: { tag, count: newCount }
        });
      }
    }

    const classChanges = this.compareArrays(
      oldSnapshot.structure.classPatterns,
      newSnapshot.structure.classPatterns
    );
    if (classChanges.added.length > 5 || classChanges.removed.length > 5) {
      changes.push({
        type: 'modified',
        impact: 'minor',
        oldValue: classChanges.removed,
        newValue: classChanges.added
      });
    }

    return changes;
  }

  private detectElementChanges(
    oldElements: ElementSignature[],
    newElements: ElementSignature[]
  ): PageChange[] {
    const changes: PageChange[] = [];
    const oldMap = new Map(oldElements.map(e => [e.hash, e]));
    const newMap = new Map(newElements.map(e => [e.hash, e]));

    for (const [hash, element] of oldMap) {
      if (!newMap.has(hash)) {
        const similar = this.findSimilarElement(element, newElements);
        if (similar) {
          const positionChange = this.calculatePositionChange(
            element.position,
            similar.position
          );
          if (positionChange > 50) {
            changes.push({
              type: 'moved',
              element: element,
              oldValue: element.position,
              newValue: similar.position,
              impact: this.determineImpact(element)
            });
          } else {
            changes.push({
              type: 'modified',
              element: element,
              oldValue: element,
              newValue: similar,
              impact: this.determineImpact(element)
            });
          }
        } else {
          changes.push({
            type: 'removed',
            element: element,
            impact: this.determineImpact(element)
          });
        }
      }
    }

    for (const [hash, element] of newMap) {
      if (!oldMap.has(hash)) {
        const similar = this.findSimilarElement(element, oldElements);
        if (!similar) {
          changes.push({
            type: 'added',
            element: element,
            impact: this.determineImpact(element)
          });
        }
      }
    }

    return changes;
  }

  private findSimilarElement(
    target: ElementSignature,
    elements: ElementSignature[]
  ): ElementSignature | null {
    let bestMatch: ElementSignature | null = null;
    let bestScore = 0;

    for (const element of elements) {
      if (element.type !== target.type) continue;

      let score = 0;
      
      if (element.selector === target.selector) score += 0.3;
      if (element.text === target.text && target.text) score += 0.3;
      
      const attrMatch = this.compareAttributes(
        target.attributes,
        element.attributes
      );
      score += attrMatch * 0.2;

      const positionSimilarity = 1 - (this.calculatePositionChange(
        target.position,
        element.position
      ) / 1000);
      score += Math.max(0, positionSimilarity) * 0.2;

      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = element;
      }
    }

    return bestMatch;
  }

  private compareAttributes(
    attrs1: Record<string, string>,
    attrs2: Record<string, string>
  ): number {
    const keys1 = Object.keys(attrs1);
    const keys2 = Object.keys(attrs2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    if (allKeys.size === 0) return 1;

    let matches = 0;
    for (const key of allKeys) {
      if (attrs1[key] === attrs2[key]) {
        matches++;
      }
    }

    return matches / allKeys.size;
  }

  private calculatePositionChange(
    pos1: { x: number; y: number; width: number; height: number },
    pos2: { x: number; y: number; width: number; height: number }
  ): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dw = pos2.width - pos1.width;
    const dh = pos2.height - pos1.height;
    
    return Math.sqrt(dx * dx + dy * dy + dw * dw + dh * dh);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private compareArrays(
    arr1: string[],
    arr2: string[]
  ): { added: string[]; removed: string[]; unchanged: string[] } {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    return {
      added: arr2.filter(x => !set1.has(x)),
      removed: arr1.filter(x => !set2.has(x)),
      unchanged: arr1.filter(x => set2.has(x))
    };
  }

  private determineImpact(element: ElementSignature): 'critical' | 'major' | 'minor' | 'cosmetic' {
    if (element.type === 'form' || element.type === 'button') {
      return 'critical';
    }
    
    if (element.type === 'input' || element.type === 'select' || element.type === 'textarea') {
      return 'major';
    }
    
    if (element.type === 'a' || element.type === 'nav') {
      return 'major';
    }
    
    if (element.selector.includes('submit') || 
        element.selector.includes('login') ||
        element.text?.toLowerCase().includes('submit') ||
        element.text?.toLowerCase().includes('next')) {
      return 'critical';
    }
    
    if (!element.visible) {
      return 'cosmetic';
    }
    
    return 'minor';
  }

  private async generateAdaptations(
    page: Page,
    changes: PageChange[],
    snapshot: PageSnapshot
  ): Promise<AdaptationStrategy[]> {
    const adaptations: AdaptationStrategy[] = [];

    const criticalChanges = changes.filter(c => c.impact === 'critical');
    if (criticalChanges.length > 0) {
      adaptations.push({
        type: 'wait-for-stability',
        description: 'Wait for page to stabilize after critical changes',
        priority: 10,
        apply: async () => {
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
      });
    }

    const removedElements = changes.filter(c => c.type === 'removed' && c.element);
    for (const change of removedElements) {
      if (change.element && (change.impact === 'critical' || change.impact === 'major')) {
        adaptations.push({
          type: 'find-alternative',
          description: `Find alternative for removed element: ${change.element.selector}`,
          priority: 8,
          apply: async () => {
            console.log(`Searching for alternative to ${change.element?.selector}`);
          }
        });
      }
    }

    const movedElements = changes.filter(c => c.type === 'moved');
    if (movedElements.length > 0) {
      adaptations.push({
        type: 'update-coordinates',
        description: 'Update element coordinates after layout changes',
        priority: 7,
        apply: async () => {
          console.log('Element positions have changed, adapting selectors');
        }
      });
    }

    if (snapshot.interactiveElements < 5) {
      adaptations.push({
        type: 'wait-for-content',
        description: 'Wait for interactive content to load',
        priority: 9,
        apply: async () => {
          await page.waitForSelector('button, a, input', { timeout: 5000 });
        }
      });
    }

    const url = page.url();
    const history = this.adaptationHistory.get(url) || [];
    this.adaptationHistory.set(url, [...history, ...adaptations]);

    return adaptations.sort((a, b) => b.priority - a.priority);
  }

  private calculateConfidence(changes: PageChange[], changeScore: number): number {
    if (changes.length === 0) return 1.0;
    
    const criticalCount = changes.filter(c => c.impact === 'critical').length;
    const majorCount = changes.filter(c => c.impact === 'major').length;
    
    let confidence = 1.0;
    confidence -= criticalCount * 0.2;
    confidence -= majorCount * 0.1;
    confidence -= changeScore * 0.3;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private storeSnapshot(url: string, snapshot: PageSnapshot): void {
    const history = this.snapshots.get(url) || [];
    history.push(snapshot);
    
    if (history.length > this.maxSnapshotsPerUrl) {
      history.shift();
    }
    
    this.snapshots.set(url, history);
  }

  public async applyAdaptations(
    adaptations: AdaptationStrategy[]
  ): Promise<void> {
    for (const adaptation of adaptations) {
      try {
        console.log(`Applying adaptation: ${adaptation.description}`);
        await adaptation.apply();
      } catch (error) {
        console.error(`Failed to apply adaptation: ${adaptation.type}`, error);
      }
    }
  }

  public getHistory(url: string): PageSnapshot[] {
    return this.snapshots.get(url) || [];
  }

  public clearHistory(url?: string): void {
    if (url) {
      this.snapshots.delete(url);
      this.adaptationHistory.delete(url);
    } else {
      this.snapshots.clear();
      this.adaptationHistory.clear();
    }
  }

  public exportData(): string {
    const data = {
      snapshots: Array.from(this.snapshots.entries()).map(([url, history]) => ({
        url,
        history: history.map(s => ({
          ...s,
          structure: {
            ...s.structure,
            nodeTypes: Array.from(s.structure.nodeTypes.entries())
          }
        }))
      })),
      adaptations: Array.from(this.adaptationHistory.entries())
    };
    
    return JSON.stringify(data, null, 2);
  }

  public importData(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      for (const item of parsed.snapshots) {
        const history = item.history.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
          structure: {
            ...h.structure,
            nodeTypes: new Map(h.structure.nodeTypes)
          }
        }));
        this.snapshots.set(item.url, history);
      }
      
      for (const [url, adaptations] of parsed.adaptations) {
        this.adaptationHistory.set(url, adaptations);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
    }
  }
}