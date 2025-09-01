import { Page, Browser } from 'playwright-core';
import { EventEmitter } from 'events';

export interface RecordedStep {
    action: 'navigate' | 'click' | 'fill' | 'select' | 'check' | 'uncheck' | 
            'hover' | 'focus' | 'press' | 'screenshot' | 'scroll' | 'wait';
    selector?: string;
    value?: string | string[];
    url?: string;
    key?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    distance?: number;
    duration?: number;
    timestamp: number;
    elementInfo?: {
        tagName: string;
        text?: string;
        attributes?: Record<string, string>;
    };
}

export interface RecorderOptions {
    captureScreenshots?: boolean;
    captureNetwork?: boolean;
    smartSelectors?: boolean;
    autoWait?: boolean;
}

export class BrowserRecorder extends EventEmitter {
    private page: Page | null = null;
    private recording: boolean = false;
    private steps: RecordedStep[] = [];
    private options: RecorderOptions;
    private networkRequests: any[] = [];
    private startTime: number = 0;

    constructor(options: RecorderOptions = {}) {
        super();
        this.options = {
            captureScreenshots: false,
            captureNetwork: false,
            smartSelectors: true,
            autoWait: true,
            ...options
        };
    }

    async startRecording(page: Page): Promise<void> {
        if (this.recording) {
            throw new Error('Already recording');
        }

        this.page = page;
        this.recording = true;
        this.steps = [];
        this.networkRequests = [];
        this.startTime = Date.now();

        // Inject recording script
        await this.injectRecordingScript();

        // Set up event listeners
        this.setupEventListeners();

        this.emit('recording-started');
    }

    async stopRecording(): Promise<RecordedStep[]> {
        if (!this.recording) {
            throw new Error('Not recording');
        }

        this.recording = false;
        this.removeEventListeners();
        
        this.emit('recording-stopped', this.steps);
        
        return this.steps;
    }

    private async injectRecordingScript(): Promise<void> {
        if (!this.page) return;

        await this.page.addInitScript(() => {
            // Track all user interactions
            const recordedEvents: any[] = [];
            
            // Helper to get element selector
            const getSelector = (element: Element): string => {
                if (element.id) {
                    return `#${element.id}`;
                }
                
                if (element.className) {
                    const classes = element.className.split(' ').filter(c => c);
                    if (classes.length) {
                        return `.${classes.join('.')}`;
                    }
                }
                
                // Use data attributes
                const dataAttrs = Array.from(element.attributes)
                    .filter(attr => attr.name.startsWith('data-'));
                if (dataAttrs.length) {
                    return `[${dataAttrs[0].name}="${dataAttrs[0].value}"]`;
                }
                
                // Use aria attributes
                const ariaLabel = element.getAttribute('aria-label');
                if (ariaLabel) {
                    return `[aria-label="${ariaLabel}"]`;
                }
                
                // Fallback to text content
                const text = element.textContent?.trim();
                if (text && text.length < 50) {
                    return `text="${text}"`;
                }
                
                // Use tag name with index
                const parent = element.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.children);
                    const index = siblings.indexOf(element);
                    return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
                }
                
                return element.tagName.toLowerCase();
            };

            // Click handler
            document.addEventListener('click', (e) => {
                const target = e.target as Element;
                if (!target) return;
                
                const selector = getSelector(target);
                (window as any).__playclone_recorder?.emit('click', {
                    selector,
                    tagName: target.tagName,
                    text: target.textContent?.trim(),
                    attributes: Object.fromEntries(
                        Array.from(target.attributes).map(attr => [attr.name, attr.value])
                    )
                });
            }, true);

            // Input handler
            document.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                if (!target) return;
                
                const selector = getSelector(target);
                (window as any).__playclone_recorder?.emit('input', {
                    selector,
                    value: target.value,
                    type: target.type
                });
            }, true);

            // Form submit handler
            document.addEventListener('submit', (e) => {
                const target = e.target as Element;
                if (!target) return;
                
                const selector = getSelector(target);
                (window as any).__playclone_recorder?.emit('submit', {
                    selector
                });
            }, true);

            // Keyboard handler
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
                    (window as any).__playclone_recorder?.emit('keypress', {
                        key: e.key,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey
                    });
                }
            }, true);

            // Scroll handler
            let scrollTimeout: any;
            window.addEventListener('scroll', (e) => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    (window as any).__playclone_recorder?.emit('scroll', {
                        x: window.scrollX,
                        y: window.scrollY
                    });
                }, 500);
            }, true);

            // Focus/blur handlers
            document.addEventListener('focus', (e) => {
                const target = e.target as Element;
                if (!target) return;
                
                const selector = getSelector(target);
                (window as any).__playclone_recorder?.emit('focus', { selector });
            }, true);

            // Hover tracking (mouseover)
            let hoverTimeout: any;
            document.addEventListener('mouseover', (e) => {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    const target = e.target as Element;
                    if (!target) return;
                    
                    const selector = getSelector(target);
                    (window as any).__playclone_recorder?.emit('hover', { selector });
                }, 1000);
            }, true);
        });

        // Set up message passing
        await this.page.exposeFunction('__playclone_recorder_emit', (event: string, data: any) => {
            this.handleBrowserEvent(event, data);
        });

        await this.page.evaluate(() => {
            (window as any).__playclone_recorder = {
                emit: (event: string, data: any) => {
                    (window as any).__playclone_recorder_emit(event, data);
                }
            };
        });
    }

    private setupEventListeners(): void {
        if (!this.page) return;

        // Navigation events
        this.page.on('framenavigated', (frame) => {
            if (frame === this.page?.mainFrame()) {
                const url = frame.url();
                if (url && url !== 'about:blank') {
                    this.addStep({
                        action: 'navigate',
                        url,
                        timestamp: Date.now()
                    });
                }
            }
        });

        // Network events (optional)
        if (this.options.captureNetwork) {
            this.page.on('request', (request) => {
                this.networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    timestamp: Date.now()
                });
            });
        }

        // Console events
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.emit('console-error', msg.text());
            }
        });

        // Dialog events
        this.page.on('dialog', async (dialog) => {
            this.emit('dialog', {
                type: dialog.type(),
                message: dialog.message()
            });
            await dialog.dismiss();
        });
    }

    private removeEventListeners(): void {
        if (!this.page) return;
        this.page.removeAllListeners();
    }

    private handleBrowserEvent(event: string, data: any): void {
        if (!this.recording) return;

        switch (event) {
            case 'click':
                this.addStep({
                    action: 'click',
                    selector: this.generateSmartSelector(data),
                    timestamp: Date.now(),
                    elementInfo: {
                        tagName: data.tagName,
                        text: data.text,
                        attributes: data.attributes
                    }
                });
                break;

            case 'input':
                // Debounce input events
                const lastStep = this.steps[this.steps.length - 1];
                if (lastStep?.action === 'fill' && 
                    lastStep.selector === this.generateSmartSelector(data) &&
                    Date.now() - lastStep.timestamp < 1000) {
                    // Update existing fill step
                    lastStep.value = data.value;
                    lastStep.timestamp = Date.now();
                } else {
                    this.addStep({
                        action: 'fill',
                        selector: this.generateSmartSelector(data),
                        value: data.value,
                        timestamp: Date.now()
                    });
                }
                break;

            case 'keypress':
                this.addStep({
                    action: 'press',
                    key: data.key,
                    timestamp: Date.now()
                });
                break;

            case 'scroll':
                this.addStep({
                    action: 'scroll',
                    direction: data.y > 0 ? 'down' : 'up',
                    distance: Math.abs(data.y),
                    timestamp: Date.now()
                });
                break;

            case 'focus':
                this.addStep({
                    action: 'focus',
                    selector: this.generateSmartSelector(data),
                    timestamp: Date.now()
                });
                break;

            case 'hover':
                this.addStep({
                    action: 'hover',
                    selector: this.generateSmartSelector(data),
                    timestamp: Date.now()
                });
                break;
        }

        this.emit('step-recorded', this.steps[this.steps.length - 1]);
    }

    private generateSmartSelector(data: any): string {
        if (!this.options.smartSelectors) {
            return data.selector;
        }

        // Generate natural language selector if possible
        if (data.text && data.text.length < 50) {
            const tagName = data.tagName?.toLowerCase();
            
            if (tagName === 'button' || tagName === 'a') {
                return `"${data.text}" ${tagName === 'a' ? 'link' : 'button'}`;
            }
            
            if (tagName === 'input' && data.attributes?.placeholder) {
                return `input with placeholder "${data.attributes.placeholder}"`;
            }
            
            if (data.attributes?.['aria-label']) {
                return `element with label "${data.attributes['aria-label']}"`;
            }
        }

        return data.selector;
    }

    private addStep(step: RecordedStep): void {
        // Add auto-wait if enabled
        if (this.options.autoWait && this.steps.length > 0) {
            const lastStep = this.steps[this.steps.length - 1];
            const timeDiff = step.timestamp - lastStep.timestamp;
            
            if (timeDiff > 2000) {
                this.steps.push({
                    action: 'wait',
                    duration: Math.round(timeDiff / 1000) * 1000,
                    timestamp: lastStep.timestamp
                });
            }
        }

        this.steps.push(step);
        
        // Take screenshot if enabled
        if (this.options.captureScreenshots && this.page) {
            this.page.screenshot({ fullPage: false }).then(buffer => {
                this.emit('screenshot', {
                    step: this.steps.length - 1,
                    data: buffer.toString('base64')
                });
            });
        }
    }

    getSteps(): RecordedStep[] {
        return [...this.steps];
    }

    clearSteps(): void {
        this.steps = [];
        this.networkRequests = [];
    }

    isRecording(): boolean {
        return this.recording;
    }

    getElapsedTime(): number {
        if (!this.startTime) return 0;
        return Date.now() - this.startTime;
    }

    async pause(): Promise<void> {
        if (!this.recording) return;
        this.recording = false;
        this.emit('recording-paused');
    }

    async resume(): Promise<void> {
        if (this.recording || !this.page) return;
        this.recording = true;
        this.emit('recording-resumed');
    }

    generateCode(language: 'javascript' | 'typescript' | 'python' = 'javascript'): string {
        if (language === 'javascript') {
            return this.generateJavaScript();
        } else if (language === 'typescript') {
            return this.generateTypeScript();
        } else {
            return this.generatePython();
        }
    }

    private generateJavaScript(): string {
        const lines = [
            "const { PlayClone } = require('playclone');",
            "",
            "async function runAutomation() {",
            "    const pc = new PlayClone({ headless: false });",
            "    await pc.launch();",
            ""
        ];

        for (const step of this.steps) {
            lines.push(this.stepToJavaScript(step));
        }

        lines.push(
            "",
            "    await pc.close();",
            "}",
            "",
            "runAutomation().catch(console.error);"
        );

        return lines.join('\n');
    }

    private generateTypeScript(): string {
        const lines = [
            "import { PlayClone } from 'playclone';",
            "",
            "async function runAutomation(): Promise<void> {",
            "    const pc = new PlayClone({ headless: false });",
            "    await pc.launch();",
            ""
        ];

        for (const step of this.steps) {
            lines.push(this.stepToJavaScript(step));
        }

        lines.push(
            "",
            "    await pc.close();",
            "}",
            "",
            "runAutomation().catch(console.error);"
        );

        return lines.join('\n');
    }

    private generatePython(): string {
        const lines = [
            "from playclone import PlayClone",
            "import asyncio",
            "",
            "async def run_automation():",
            "    pc = PlayClone(headless=False)",
            "    await pc.launch()",
            ""
        ];

        for (const step of this.steps) {
            lines.push(this.stepToPython(step));
        }

        lines.push(
            "",
            "    await pc.close()",
            "",
            "asyncio.run(run_automation())"
        );

        return lines.join('\n');
    }

    private stepToJavaScript(step: RecordedStep): string {
        const indent = "    ";
        
        switch (step.action) {
            case 'navigate':
                return `${indent}await pc.navigate('${step.url}');`;
            case 'click':
                return `${indent}await pc.click('${step.selector}');`;
            case 'fill':
                return `${indent}await pc.fill('${step.selector}', '${step.value}');`;
            case 'press':
                return `${indent}await pc.press('${step.key}');`;
            case 'wait':
                return `${indent}await pc.wait(${step.duration});`;
            case 'screenshot':
                return `${indent}await pc.screenshot();`;
            case 'scroll':
                return `${indent}await pc.scroll('${step.direction}', ${step.distance});`;
            case 'hover':
                return `${indent}await pc.hover('${step.selector}');`;
            case 'focus':
                return `${indent}await pc.focus('${step.selector}');`;
            default:
                return `${indent}// ${step.action}`;
        }
    }

    private stepToPython(step: RecordedStep): string {
        const indent = "    ";
        
        switch (step.action) {
            case 'navigate':
                return `${indent}await pc.navigate('${step.url}')`;
            case 'click':
                return `${indent}await pc.click('${step.selector}')`;
            case 'fill':
                return `${indent}await pc.fill('${step.selector}', '${step.value}')`;
            default:
                return `${indent}# ${step.action}`;
        }
    }
}