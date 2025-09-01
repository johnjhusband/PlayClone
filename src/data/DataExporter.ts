import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * DataExporter - Export extracted data to various formats
 * Supports CSV, Excel, JSON, and XML exports with customization options
 */
export class DataExporter {
    /**
     * Export data to CSV format
     */
    static async exportToCSV(
        data: any[],
        options: {
            headers?: string[];
            delimiter?: string;
            quote?: string;
            escapeQuote?: string;
            lineEnd?: string;
            includeHeaders?: boolean;
        } = {}
    ): Promise<string> {
        const {
            delimiter = ',',
            quote = '"',
            escapeQuote = '""',
            lineEnd = '\n',
            includeHeaders = true
        } = options;

        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        // Auto-detect headers if not provided
        const headers = options.headers || Object.keys(data[0]);
        const rows: string[] = [];

        // Add headers if requested
        if (includeHeaders) {
            rows.push(headers.map(h => this.escapeCSVField(h, quote, escapeQuote)).join(delimiter));
        }

        // Add data rows
        for (const item of data) {
            const row = headers.map(header => {
                const value = this.getNestedValue(item, header);
                return this.escapeCSVField(value, quote, escapeQuote);
            });
            rows.push(row.join(delimiter));
        }

        return rows.join(lineEnd);
    }

    /**
     * Export data to Excel format (as CSV with Excel-compatible formatting)
     * Note: For true Excel format, use a library like xlsx
     */
    static async exportToExcel(
        data: any[],
        options: {
            headers?: string[];
            sheetName?: string;
            includeHeaders?: boolean;
        } = {}
    ): Promise<string> {
        // For Excel compatibility, use tab delimiter and UTF-8 BOM
        const csv = await this.exportToCSV(data, {
            ...options,
            delimiter: '\t',
            includeHeaders: options.includeHeaders !== false
        });

        // Add UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        return BOM + csv;
    }

    /**
     * Export data to JSON format
     */
    static async exportToJSON(
        data: any,
        options: {
            pretty?: boolean;
            indent?: number;
            replacer?: ((key: string, value: any) => any) | string[];
        } = {}
    ): Promise<string> {
        const { pretty = true, indent = 2, replacer } = options;

        if (pretty) {
            return JSON.stringify(data, replacer as any, indent);
        }

        return JSON.stringify(data, replacer as any);
    }

    /**
     * Export data to XML format
     */
    static async exportToXML(
        data: any,
        options: {
            rootElement?: string;
            itemElement?: string;
            indent?: boolean;
            declaration?: boolean;
            attributes?: Record<string, string>;
        } = {}
    ): Promise<string> {
        const {
            rootElement = 'data',
            itemElement = 'item',
            indent = true,
            declaration = true,
            attributes = {}
        } = options;

        const lines: string[] = [];

        // Add XML declaration
        if (declaration) {
            lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        }

        // Start root element
        const attrString = Object.entries(attributes)
            .map(([key, value]) => `${key}="${this.escapeXML(value)}"`)
            .join(' ');
        lines.push(`<${rootElement}${attrString ? ' ' + attrString : ''}>`);

        // Add data items
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
            lines.push(this.objectToXML(item, itemElement, indent ? 2 : 0));
        }

        // Close root element
        lines.push(`</${rootElement}>`);

        return lines.join(indent ? '\n' : '');
    }

    /**
     * Export data to file with automatic format detection
     */
    static async exportToFile(
        data: any,
        filePath: string,
        options: Record<string, any> = {}
    ): Promise<void> {
        const ext = path.extname(filePath).toLowerCase();
        let content: string;

        switch (ext) {
            case '.csv':
                content = await this.exportToCSV(data, options);
                break;
            case '.xlsx':
            case '.xls':
                content = await this.exportToExcel(data, options);
                break;
            case '.json':
                content = await this.exportToJSON(data, options);
                break;
            case '.xml':
                content = await this.exportToXML(data, options);
                break;
            default:
                throw new Error(`Unsupported file format: ${ext}`);
        }

        await fs.writeFile(filePath, content, 'utf-8');
    }

    /**
     * Convert data between formats
     */
    static async convertFormat(
        data: any,
        fromFormat: 'csv' | 'json' | 'xml',
        toFormat: 'csv' | 'json' | 'xml' | 'excel',
        options: Record<string, any> = {}
    ): Promise<string> {
        // Parse input if needed
        let parsed = data;
        if (typeof data === 'string') {
            switch (fromFormat) {
                case 'csv':
                    parsed = await this.parseCSV(data, options);
                    break;
                case 'json':
                    parsed = JSON.parse(data);
                    break;
                case 'xml':
                    parsed = await this.parseXML(data);
                    break;
            }
        }

        // Convert to target format
        switch (toFormat) {
            case 'csv':
                return await this.exportToCSV(parsed, options);
            case 'excel':
                return await this.exportToExcel(parsed, options);
            case 'json':
                return await this.exportToJSON(parsed, options);
            case 'xml':
                return await this.exportToXML(parsed, options);
            default:
                throw new Error(`Unsupported target format: ${toFormat}`);
        }
    }

    /**
     * Stream export for large datasets
     */
    static async *streamExport(
        dataIterator: AsyncIterable<any> | AsyncIterator<any>,
        format: 'csv' | 'json' | 'xml',
        options: Record<string, any> = {}
    ): AsyncGenerator<string> {
        let isFirst = true;
        let headers: string[] = [];

        // Start of document
        switch (format) {
            case 'json':
                yield '[';
                break;
            case 'xml':
                if (options.declaration !== false) {
                    yield '<?xml version="1.0" encoding="UTF-8"?>\n';
                }
                yield `<${options.rootElement || 'data'}>`;
                break;
        }

        // Process data items
        const iterator = Symbol.asyncIterator in dataIterator 
            ? dataIterator[Symbol.asyncIterator]() 
            : dataIterator as AsyncIterator<any>;
            
        let result = await iterator.next();
        while (!result.done) {
            const item = result.value;
            switch (format) {
                case 'csv':
                    if (isFirst) {
                        headers = options.headers || Object.keys(item);
                        if (options.includeHeaders !== false) {
                            yield headers.map(h => this.escapeCSVField(h, '"', '""')).join(',') + '\n';
                        }
                    }
                    const row = headers.map(h => 
                        this.escapeCSVField(this.getNestedValue(item, h), '"', '""')
                    );
                    yield row.join(',') + '\n';
                    break;

                case 'json':
                    if (!isFirst) yield ',';
                    yield JSON.stringify(item);
                    break;

                case 'xml':
                    yield this.objectToXML(item, options.itemElement || 'item', 2);
                    break;
            }
            isFirst = false;
            result = await iterator.next();
        }

        // End of document
        switch (format) {
            case 'json':
                yield ']';
                break;
            case 'xml':
                yield `</${options.rootElement || 'data'}>`;
                break;
        }
    }

    // Helper methods

    private static escapeCSVField(value: any, quote: string, escapeQuote: string): string {
        const str = value == null ? '' : String(value);
        
        // Check if field needs quoting
        if (str.includes(',') || str.includes(quote) || str.includes('\n') || str.includes('\r')) {
            return quote + str.replace(new RegExp(quote, 'g'), escapeQuote) + quote;
        }
        
        return str;
    }

    private static escapeXML(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private static objectToXML(obj: any, elementName: string, indent: number): string {
        const spaces = ' '.repeat(indent);
        const innerSpaces = ' '.repeat(indent + 2);

        if (obj == null) {
            return `${spaces}<${elementName}/>`;
        }

        if (typeof obj !== 'object' || obj instanceof Date) {
            return `${spaces}<${elementName}>${this.escapeXML(String(obj))}</${elementName}>`;
        }

        const lines: string[] = [`${spaces}<${elementName}>`];

        for (const [key, value] of Object.entries(obj)) {
            const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
            
            if (Array.isArray(value)) {
                for (const item of value) {
                    lines.push(this.objectToXML(item, safeKey, indent + 2));
                }
            } else if (value != null && typeof value === 'object' && !(value instanceof Date)) {
                lines.push(this.objectToXML(value, safeKey, indent + 2));
            } else if (value != null) {
                lines.push(`${innerSpaces}<${safeKey}>${this.escapeXML(String(value))}</${safeKey}>`);
            }
        }

        lines.push(`${spaces}</${elementName}>`);
        return lines.join('\n');
    }

    private static getNestedValue(obj: any, path: string): any {
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) break;
        }
        
        return value;
    }

    private static async parseCSV(csv: string, options: any = {}): Promise<any[]> {
        const lines = csv.split(/\r?\n/);
        const delimiter = options.delimiter || ',';
        const hasHeaders = options.includeHeaders !== false;
        
        if (lines.length === 0) return [];

        const headers = hasHeaders ? lines[0].split(delimiter) : [];
        const dataLines = hasHeaders ? lines.slice(1) : lines;
        
        return dataLines
            .filter(line => line.trim())
            .map(line => {
                const values = line.split(delimiter);
                if (!hasHeaders) return values;
                
                const obj: any = {};
                headers.forEach((header, i) => {
                    obj[header] = values[i]?.replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
                });
                return obj;
            });
    }

    private static async parseXML(xml: string): Promise<any> {
        // Simplified XML parsing - in production, use a proper XML parser
        const items: any[] = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        const matches = xml.matchAll(itemRegex);
        
        for (const match of matches) {
            const itemXml = match[1];
            const obj: any = {};
            
            // Extract simple key-value pairs
            const kvRegex = /<([^>]+)>([^<]*)<\/\1>/g;
            const kvMatches = itemXml.matchAll(kvRegex);
            
            for (const kvMatch of kvMatches) {
                obj[kvMatch[1]] = kvMatch[2];
            }
            
            items.push(obj);
        }
        
        return items;
    }

    /**
     * Create export summary report
     */
    static createExportReport(
        data: any[],
        format: string,
        options: {
            includeStats?: boolean;
            includeSample?: boolean;
            sampleSize?: number;
        } = {}
    ): any {
        const { includeStats = true, includeSample = false, sampleSize = 5 } = options;

        const report: any = {
            format,
            totalRecords: Array.isArray(data) ? data.length : 1,
            exportDate: new Date().toISOString()
        };

        if (includeStats && Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            report.fields = Object.keys(firstItem);
            report.fieldCount = report.fields.length;
            
            // Calculate field statistics
            const fieldStats: any = {};
            for (const field of report.fields) {
                const values = data.map(item => item[field]);
                const nonNull = values.filter(v => v != null);
                
                fieldStats[field] = {
                    nullCount: values.length - nonNull.length,
                    uniqueCount: new Set(nonNull).size,
                    type: typeof nonNull[0]
                };
            }
            report.fieldStatistics = fieldStats;
        }

        if (includeSample && Array.isArray(data)) {
            report.sample = data.slice(0, sampleSize);
        }

        return report;
    }
}