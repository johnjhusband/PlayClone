import { Page, ElementHandle } from 'playwright-core';

/**
 * Table data structure
 */
export interface TableData {
  headers: string[];
  rows: string[][];
  metadata?: {
    caption?: string;
    summary?: string;
    rowCount: number;
    columnCount: number;
    hasHeaders: boolean;
    isNested: boolean;
  };
}

/**
 * Table detection result
 */
export interface TableDetectionResult {
  success: boolean;
  tables: TableData[];
  count: number;
  errors?: string[];
}

/**
 * Table extraction options
 */
export interface TableExtractionOptions {
  includeHidden?: boolean;
  minRows?: number;
  minColumns?: number;
  detectImplicitTables?: boolean;
  mergeSpannedCells?: boolean;
  cleanWhitespace?: boolean;
  convertToJSON?: boolean;
  inferDataTypes?: boolean;
}

/**
 * Implicit table patterns for detecting non-standard tables
 */
interface ImplicitTablePattern {
  containerSelector: string;
  rowSelector: string;
  cellSelector: string;
  headerSelector?: string;
  isValid?: (container: ElementHandle) => Promise<boolean>;
}

/**
 * Automatic table detection and parsing
 */
export class TableDetector {
  private readonly implicitPatterns: ImplicitTablePattern[] = [
    // Grid/flexbox tables
    {
      containerSelector: '.table, .data-table, [role="table"]',
      rowSelector: '.row, .table-row, [role="row"]',
      cellSelector: '.cell, .table-cell, [role="cell"]',
      headerSelector: '.header, .table-header, [role="columnheader"]'
    },
    // List-based tables
    {
      containerSelector: 'ul.table, ol.table',
      rowSelector: 'li',
      cellSelector: 'span, div',
      isValid: async (container) => {
        const items = await container.$$('li');
        if (items.length < 2) return false;
        const firstItemCells = await items[0].$$('span, div');
        const secondItemCells = await items[1].$$('span, div');
        return firstItemCells.length === secondItemCells.length && firstItemCells.length > 1;
      }
    },
    // Definition lists as tables
    {
      containerSelector: 'dl',
      rowSelector: 'dt, dd',
      cellSelector: 'dt, dd',
      isValid: async (container) => {
        const dts = await container.$$('dt');
        const dds = await container.$$('dd');
        return dts.length > 0 && dts.length === dds.length;
      }
    },
    // Bootstrap-style tables
    {
      containerSelector: '.table-responsive',
      rowSelector: 'tr, .row',
      cellSelector: 'td, th, .col',
      headerSelector: 'thead th, .header'
    },
    // Card-based tables
    {
      containerSelector: '.card-deck, .card-group',
      rowSelector: '.card',
      cellSelector: '.card-body > *',
      headerSelector: '.card-header'
    }
  ];

  /**
   * Detect and extract all tables from a page
   */
  async detectTables(
    page: Page,
    options: TableExtractionOptions = {}
  ): Promise<TableDetectionResult> {
    const {
      includeHidden = false,
      minRows = 1,
      minColumns = 1,
      detectImplicitTables = true,
      mergeSpannedCells = true,
      cleanWhitespace = true,
      inferDataTypes = false
    } = options;

    const tables: TableData[] = [];
    const errors: string[] = [];

    try {
      // Extract standard HTML tables
      const htmlTables = await this.extractHTMLTables(
        page,
        includeHidden,
        mergeSpannedCells,
        cleanWhitespace
      );
      tables.push(...htmlTables);

      // Detect implicit tables if enabled
      if (detectImplicitTables) {
        const implicitTables = await this.detectImplicitTables(
          page,
          includeHidden,
          cleanWhitespace
        );
        tables.push(...implicitTables);
      }

      // Filter by minimum size
      const filteredTables = tables.filter(table => 
        table.rows.length >= minRows && 
        (table.headers.length >= minColumns || 
         (table.rows[0] && table.rows[0].length >= minColumns))
      );

      // Infer data types if requested
      if (inferDataTypes) {
        filteredTables.forEach(table => {
          this.inferTableDataTypes(table);
        });
      }

      return {
        success: true,
        tables: filteredTables,
        count: filteredTables.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error: any) {
      return {
        success: false,
        tables: [],
        count: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Extract standard HTML tables
   */
  private async extractHTMLTables(
    page: Page,
    includeHidden: boolean,
    mergeSpannedCells: boolean,
    cleanWhitespace: boolean
  ): Promise<TableData[]> {
    const tables = await page.$$('table');
    const extractedTables: TableData[] = [];

    for (const table of tables) {
      try {
        // Check visibility
        if (!includeHidden) {
          const isVisible = await table.isVisible();
          if (!isVisible) continue;
        }

        // Extract table data
        const tableData = await table.evaluate((tableEl: HTMLTableElement, opts: any) => {
          const { merge, clean } = opts;
          const headers: string[] = [];
          const rows: string[][] = [];
          let caption: string | undefined;
          let summary: string | undefined;

          // Extract caption
          const captionEl = tableEl.querySelector('caption');
          if (captionEl) {
            caption = captionEl.textContent?.trim();
          }

          // Extract summary attribute
          summary = tableEl.getAttribute('summary') || undefined;

          // Extract headers from thead
          const thead = tableEl.querySelector('thead');
          if (thead) {
            const headerCells = thead.querySelectorAll('th, td');
            headerCells.forEach((cell: any) => {
              let text = cell.textContent || '';
              if (clean) text = text.trim().replace(/\s+/g, ' ');
              
              // Handle colspan
              const colspan = parseInt(cell.getAttribute('colspan') || '1');
              if (merge && colspan > 1) {
                for (let i = 0; i < colspan; i++) {
                  headers.push(text);
                }
              } else {
                headers.push(text);
              }
            });
          }

          // If no thead, check first row for th elements
          if (headers.length === 0) {
            const firstRow = tableEl.querySelector('tr');
            if (firstRow) {
              const thCells = firstRow.querySelectorAll('th');
              if (thCells.length > 0) {
                thCells.forEach((cell: any) => {
                  let text = cell.textContent || '';
                  if (clean) text = text.trim().replace(/\s+/g, ' ');
                  
                  const colspan = parseInt(cell.getAttribute('colspan') || '1');
                  if (merge && colspan > 1) {
                    for (let i = 0; i < colspan; i++) {
                      headers.push(text);
                    }
                  } else {
                    headers.push(text);
                  }
                });
              }
            }
          }

          // Extract rows from tbody or directly from table
          const tbody = tableEl.querySelector('tbody') || tableEl;
          const dataRows = tbody.querySelectorAll('tr');
          
          dataRows.forEach((row: any) => {
            // Skip header rows
            if (headers.length > 0 && row.querySelector('th:first-child') && !row.querySelector('td')) {
              return;
            }

            const cells: string[] = [];
            const rowCells = row.querySelectorAll('td, th');
            
            rowCells.forEach((cell: any) => {
              let text = cell.textContent || '';
              if (clean) text = text.trim().replace(/\s+/g, ' ');
              
              // Handle colspan and rowspan
              const colspan = parseInt(cell.getAttribute('colspan') || '1');
              const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
              
              if (merge && colspan > 1) {
                for (let i = 0; i < colspan; i++) {
                  cells.push(text);
                }
              } else {
                cells.push(text);
              }
              
              // Note: Full rowspan handling would require more complex logic
            });

            if (cells.length > 0) {
              rows.push(cells);
            }
          });

          return {
            headers,
            rows,
            caption,
            summary,
            hasHeaders: headers.length > 0,
            isNested: tableEl.querySelector('table') !== null
          };
        }, { merge: mergeSpannedCells, clean: cleanWhitespace });

        extractedTables.push({
          headers: tableData.headers,
          rows: tableData.rows,
          metadata: {
            caption: tableData.caption,
            summary: tableData.summary,
            rowCount: tableData.rows.length,
            columnCount: Math.max(
              tableData.headers.length,
              ...tableData.rows.map(r => r.length)
            ),
            hasHeaders: tableData.hasHeaders,
            isNested: tableData.isNested
          }
        });
      } catch (error) {
        // Skip problematic tables
        continue;
      }
    }

    return extractedTables;
  }

  /**
   * Detect implicit tables (non-standard table structures)
   */
  private async detectImplicitTables(
    page: Page,
    includeHidden: boolean,
    cleanWhitespace: boolean
  ): Promise<TableData[]> {
    const implicitTables: TableData[] = [];

    for (const pattern of this.implicitPatterns) {
      try {
        const containers = await page.$$(pattern.containerSelector);
        
        for (const container of containers) {
          // Check visibility
          if (!includeHidden) {
            const isVisible = await container.isVisible();
            if (!isVisible) continue;
          }

          // Validate if needed
          if (pattern.isValid) {
            const isValid = await pattern.isValid(container);
            if (!isValid) continue;
          }

          // Check if this is actually an HTML table (skip if so)
          const isHTMLTable = await container.evaluate(el => el.tagName === 'TABLE');
          if (isHTMLTable) continue;

          // Extract data
          const tableData = await this.extractImplicitTable(
            container,
            pattern,
            cleanWhitespace
          );

          if (tableData && tableData.rows.length > 0) {
            implicitTables.push(tableData);
          }
        }
      } catch (error) {
        // Skip problematic patterns
        continue;
      }
    }

    return implicitTables;
  }

  /**
   * Extract data from an implicit table structure
   */
  private async extractImplicitTable(
    container: ElementHandle,
    pattern: ImplicitTablePattern,
    cleanWhitespace: boolean
  ): Promise<TableData | null> {
    try {
      const data = await container.evaluate((el: HTMLElement, args: {pat: any, clean: boolean}) => {
        const { pat, clean } = args;
        const headers: string[] = [];
        const rows: string[][] = [];

        // Extract headers if pattern includes them
        if (pat.headerSelector) {
          const headerEls = el.querySelectorAll(pat.headerSelector);
          headerEls.forEach((header: any) => {
            let text = header.textContent || '';
            if (clean) text = text.trim().replace(/\s+/g, ' ');
            headers.push(text);
          });
        }

        // Extract rows
        const rowEls = el.querySelectorAll(pat.rowSelector);
        rowEls.forEach((rowEl: any) => {
          // Skip header row if already extracted
          if (pat.headerSelector && rowEl.querySelector(pat.headerSelector)) {
            return;
          }

          const cells: string[] = [];
          const cellEls = rowEl.querySelectorAll(pat.cellSelector);
          
          cellEls.forEach((cell: any) => {
            let text = cell.textContent || '';
            if (clean) text = text.trim().replace(/\s+/g, ' ');
            cells.push(text);
          });

          if (cells.length > 0) {
            rows.push(cells);
          }
        });

        // Special handling for definition lists
        if (el.tagName === 'DL') {
          const dts = el.querySelectorAll('dt');
          const dds = el.querySelectorAll('dd');
          
          if (dts.length === dds.length && dts.length > 0) {
            headers.push('Term', 'Definition');
            rows.length = 0; // Clear any previous extraction
            
            for (let i = 0; i < dts.length; i++) {
              let term = (dts[i] as any).textContent || '';
              let def = (dds[i] as any).textContent || '';
              
              if (clean) {
                term = term.trim().replace(/\s+/g, ' ');
                def = def.trim().replace(/\s+/g, ' ');
              }
              
              rows.push([term, def]);
            }
          }
        }

        return { headers, rows };
      }, { pat: pattern, clean: cleanWhitespace });

      if (!data || data.rows.length === 0) {
        return null;
      }

      return {
        headers: data.headers,
        rows: data.rows,
        metadata: {
          rowCount: data.rows.length,
          columnCount: Math.max(
            data.headers.length,
            ...data.rows.map(r => r.length)
          ),
          hasHeaders: data.headers.length > 0,
          isNested: false
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Infer data types for table columns
   */
  private inferTableDataTypes(table: TableData): void {
    if (!table.metadata) {
      table.metadata = {
        rowCount: table.rows.length,
        columnCount: Math.max(
          table.headers.length,
          ...table.rows.map(r => r.length)
        ),
        hasHeaders: table.headers.length > 0,
        isNested: false
      };
    }

    const columnTypes: string[] = [];
    const columnCount = table.metadata.columnCount;

    for (let col = 0; col < columnCount; col++) {
      const values = table.rows.map(row => row[col]).filter(v => v);
      const type = this.inferColumnType(values);
      columnTypes.push(type);
    }

    (table.metadata as any).columnTypes = columnTypes;
  }

  /**
   * Infer data type for a column based on its values
   */
  private inferColumnType(values: string[]): string {
    if (values.length === 0) return 'unknown';

    let isNumber = true;
    let isDate = true;
    let isBoolean = true;
    let isEmail = true;
    let isURL = true;
    let isCurrency = true;

    for (const value of values) {
      const trimmed = value.trim();
      
      // Check number
      if (isNumber && !/^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ''))) {
        isNumber = false;
      }

      // Check date
      if (isDate && !this.isValidDate(trimmed)) {
        isDate = false;
      }

      // Check boolean
      if (isBoolean && !['true', 'false', 'yes', 'no', '1', '0'].includes(trimmed.toLowerCase())) {
        isBoolean = false;
      }

      // Check email
      if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        isEmail = false;
      }

      // Check URL
      if (isURL && !/^https?:\/\//.test(trimmed)) {
        isURL = false;
      }

      // Check currency
      if (isCurrency && !/^[$€£¥]?\s*\d+([.,]\d+)*$/.test(trimmed) && 
          !/^\d+([.,]\d+)*\s*[$€£¥]$/.test(trimmed)) {
        isCurrency = false;
      }
    }

    if (isCurrency) return 'currency';
    if (isNumber) return 'number';
    if (isDate) return 'date';
    if (isBoolean) return 'boolean';
    if (isEmail) return 'email';
    if (isURL) return 'url';
    return 'text';
  }

  /**
   * Check if a string is a valid date
   */
  private isValidDate(str: string): boolean {
    const date = new Date(str);
    return !isNaN(date.getTime()) && str.length > 4;
  }

  /**
   * Convert table to various formats
   */
  async convertTable(
    table: TableData,
    format: 'csv' | 'json' | 'markdown' | 'html'
  ): Promise<string> {
    switch (format) {
      case 'csv':
        return this.tableToCSV(table);
      case 'json':
        return this.tableToJSON(table);
      case 'markdown':
        return this.tableToMarkdown(table);
      case 'html':
        return this.tableToHTML(table);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Convert table to CSV format
   */
  private tableToCSV(table: TableData): string {
    const lines: string[] = [];
    
    // Add headers if present
    if (table.headers.length > 0) {
      lines.push(table.headers.map(h => this.escapeCSV(h)).join(','));
    }
    
    // Add rows
    for (const row of table.rows) {
      lines.push(row.map(cell => this.escapeCSV(cell)).join(','));
    }
    
    return lines.join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Convert table to JSON format
   */
  private tableToJSON(table: TableData): string {
    if (table.headers.length > 0) {
      // Convert to array of objects using headers as keys
      const objects = table.rows.map(row => {
        const obj: any = {};
        table.headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
      return JSON.stringify(objects, null, 2);
    } else {
      // Return as array of arrays
      return JSON.stringify(table.rows, null, 2);
    }
  }

  /**
   * Convert table to Markdown format
   */
  private tableToMarkdown(table: TableData): string {
    const lines: string[] = [];
    
    // Add headers
    if (table.headers.length > 0) {
      lines.push('| ' + table.headers.join(' | ') + ' |');
      lines.push('| ' + table.headers.map(() => '---').join(' | ') + ' |');
    }
    
    // Add rows
    for (const row of table.rows) {
      lines.push('| ' + row.join(' | ') + ' |');
    }
    
    return lines.join('\n');
  }

  /**
   * Convert table to HTML format
   */
  private tableToHTML(table: TableData): string {
    const lines: string[] = ['<table>'];
    
    // Add caption if present
    if (table.metadata?.caption) {
      lines.push(`  <caption>${this.escapeHTML(table.metadata.caption)}</caption>`);
    }
    
    // Add headers
    if (table.headers.length > 0) {
      lines.push('  <thead>');
      lines.push('    <tr>');
      for (const header of table.headers) {
        lines.push(`      <th>${this.escapeHTML(header)}</th>`);
      }
      lines.push('    </tr>');
      lines.push('  </thead>');
    }
    
    // Add body
    lines.push('  <tbody>');
    for (const row of table.rows) {
      lines.push('    <tr>');
      for (const cell of row) {
        lines.push(`      <td>${this.escapeHTML(cell)}</td>`);
      }
      lines.push('    </tr>');
    }
    lines.push('  </tbody>');
    
    lines.push('</table>');
    return lines.join('\n');
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Find tables by content
   */
  async findTablesByContent(
    page: Page,
    searchText: string,
    options: TableExtractionOptions = {}
  ): Promise<TableData[]> {
    const result = await this.detectTables(page, options);
    if (!result.success) return [];

    return result.tables.filter(table => {
      // Search in headers
      if (table.headers.some(h => h.toLowerCase().includes(searchText.toLowerCase()))) {
        return true;
      }
      
      // Search in rows
      return table.rows.some(row => 
        row.some(cell => cell.toLowerCase().includes(searchText.toLowerCase()))
      );
    });
  }

  /**
   * Extract specific columns from a table
   */
  extractColumns(table: TableData, columnIndices: number[]): TableData {
    const newHeaders = columnIndices.map(i => table.headers[i] || '');
    const newRows = table.rows.map(row => 
      columnIndices.map(i => row[i] || '')
    );

    return {
      headers: newHeaders,
      rows: newRows,
      metadata: table.metadata ? {
        ...table.metadata,
        columnCount: columnIndices.length
      } : {
        rowCount: newRows.length,
        columnCount: columnIndices.length,
        hasHeaders: newHeaders.length > 0,
        isNested: false
      }
    };
  }

  /**
   * Filter table rows by condition
   */
  filterRows(
    table: TableData,
    predicate: (row: string[], index: number) => boolean
  ): TableData {
    const filteredRows = table.rows.filter(predicate);
    
    return {
      headers: table.headers,
      rows: filteredRows,
      metadata: table.metadata ? {
        ...table.metadata,
        rowCount: filteredRows.length
      } : {
        rowCount: filteredRows.length,
        columnCount: table.headers.length,
        hasHeaders: table.headers.length > 0,
        isNested: false
      }
    };
  }

  /**
   * Sort table by column
   */
  sortTable(
    table: TableData,
    columnIndex: number,
    ascending: boolean = true
  ): TableData {
    const sortedRows = [...table.rows].sort((a, b) => {
      const valA = a[columnIndex] || '';
      const valB = b[columnIndex] || '';
      
      // Try numeric comparison first
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      
      // Fall back to string comparison
      return ascending 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

    return {
      headers: table.headers,
      rows: sortedRows,
      metadata: table.metadata
    };
  }
}