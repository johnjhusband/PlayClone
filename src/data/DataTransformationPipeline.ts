import { Page } from 'playwright-core';
import { DataValidator } from './DataValidator';
import { DataExporter } from './DataExporter';

export interface TransformStep {
  name: string;
  type: 'map' | 'filter' | 'reduce' | 'sort' | 'group' | 'join' | 'pivot' | 'aggregate' | 'custom';
  field?: string;
  condition?: (item: any) => boolean;
  transform?: (item: any) => any;
  reducer?: (acc: any, item: any) => any;
  initialValue?: any;
  sortBy?: string | ((a: any, b: any) => number);
  groupBy?: string | ((item: any) => string);
  joinWith?: any[];
  joinOn?: string;
  pivotOn?: string;
  pivotValue?: string;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  customFunction?: (data: any[]) => any[];
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: TransformStep[];
  inputValidation?: any;
  outputValidation?: any;
  errorHandling?: 'skip' | 'stop' | 'default';
  defaultValue?: any;
}

export interface TransformResult {
  success: boolean;
  data?: any;
  errors?: Array<{ step: string; error: string; item?: any }>;
  metrics?: {
    inputCount: number;
    outputCount: number;
    duration: number;
    stepsExecuted: number;
    errorsCount: number;
  };
}

export class DataTransformationPipeline {
  private pipelines: Map<string, Pipeline> = new Map();
  private validator: DataValidator;
  private exporter: DataExporter;
  private transformHistory: Array<{
    pipelineId: string;
    timestamp: Date;
    result: TransformResult;
  }> = [];

  constructor(page?: Page) {
    // DataValidator is optional - will be created when page is available
    this.validator = page ? new DataValidator(page) : null as any;
    this.exporter = new DataExporter();
    this.initializeBuiltInPipelines();
  }

  private initializeBuiltInPipelines(): void {
    // E-commerce data normalization pipeline
    this.registerPipeline({
      id: 'ecommerce-normalize',
      name: 'E-commerce Data Normalization',
      description: 'Normalize product data from various sources',
      steps: [
        {
          name: 'Clean prices',
          type: 'map',
          transform: (item: any) => ({
            ...item,
            price: typeof item.price === 'string' 
              ? parseFloat(item.price.replace(/[^0-9.]/g, ''))
              : item.price
          })
        },
        {
          name: 'Filter valid products',
          type: 'filter',
          condition: (item: any) => item.price > 0 && item.title
        },
        {
          name: 'Add metadata',
          type: 'map',
          transform: (item: any) => ({
            ...item,
            processedAt: new Date().toISOString(),
            source: item.source || 'unknown'
          })
        },
        {
          name: 'Sort by price',
          type: 'sort',
          sortBy: (a: any, b: any) => a.price - b.price
        }
      ]
    });

    // Web scraping cleanup pipeline
    this.registerPipeline({
      id: 'web-scrape-cleanup',
      name: 'Web Scraping Data Cleanup',
      description: 'Clean and structure scraped web data',
      steps: [
        {
          name: 'Remove empty fields',
          type: 'map',
          transform: (item: any) => {
            const cleaned: any = {};
            for (const [key, value] of Object.entries(item)) {
              if (value !== null && value !== undefined && value !== '') {
                cleaned[key] = value;
              }
            }
            return cleaned;
          }
        },
        {
          name: 'Trim strings',
          type: 'map',
          transform: (item: any) => {
            const trimmed: any = {};
            for (const [key, value] of Object.entries(item)) {
              trimmed[key] = typeof value === 'string' ? value.trim() : value;
            }
            return trimmed;
          }
        },
        {
          name: 'Deduplicate',
          type: 'custom',
          customFunction: (data: any[]) => {
            const seen = new Set();
            return data.filter(item => {
              const key = JSON.stringify(item);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
        }
      ]
    });

    // Analytics aggregation pipeline
    this.registerPipeline({
      id: 'analytics-aggregate',
      name: 'Analytics Data Aggregation',
      description: 'Aggregate and summarize analytics data',
      steps: [
        {
          name: 'Group by date',
          type: 'group',
          groupBy: (item: any) => item.date?.split('T')[0] || 'unknown'
        },
        {
          name: 'Calculate daily totals',
          type: 'map',
          transform: (group: any) => ({
            date: group.key,
            total: group.items.reduce((sum: number, item: any) => 
              sum + (item.value || 0), 0),
            count: group.items.length,
            average: group.items.reduce((sum: number, item: any) => 
              sum + (item.value || 0), 0) / group.items.length
          })
        },
        {
          name: 'Sort by date',
          type: 'sort',
          sortBy: 'date'
        }
      ]
    });
  }

  registerPipeline(pipeline: Pipeline): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  async execute(pipelineId: string, data: any[]): Promise<TransformResult> {
    const startTime = Date.now();
    const pipeline = this.pipelines.get(pipelineId);
    
    if (!pipeline) {
      return {
        success: false,
        errors: [{ step: 'pipeline', error: `Pipeline ${pipelineId} not found` }]
      };
    }

    let result = [...data];
    const errors: Array<{ step: string; error: string; item?: any }> = [];
    let stepsExecuted = 0;

    // Input validation
    if (pipeline.inputValidation) {
      const validationResult = this.validateData(result, pipeline.inputValidation);
      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors?.map(e => ({
            step: 'input-validation',
            error: e
          }))
        };
      }
    }

    // Execute pipeline steps
    for (const step of pipeline.steps) {
      try {
        result = await this.executeStep(step, result);
        stepsExecuted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ step: step.name, error: errorMessage });

        if (pipeline.errorHandling === 'stop') {
          break;
        } else if (pipeline.errorHandling === 'default') {
          result = pipeline.defaultValue || [];
        }
      }
    }

    // Output validation
    if (pipeline.outputValidation) {
      const validationResult = this.validateData(result, pipeline.outputValidation);
      if (!validationResult.valid) {
        errors.push(...(validationResult.errors || []).map(e => ({
          step: 'output-validation',
          error: e
        })));
      }
    }

    const transformResult: TransformResult = {
      success: errors.length === 0,
      data: result,
      errors: errors.length > 0 ? errors : undefined,
      metrics: {
        inputCount: data.length,
        outputCount: result.length,
        duration: Date.now() - startTime,
        stepsExecuted,
        errorsCount: errors.length
      }
    };

    this.transformHistory.push({
      pipelineId,
      timestamp: new Date(),
      result: transformResult
    });

    return transformResult;
  }

  private async executeStep(step: TransformStep, data: any[]): Promise<any[]> {
    switch (step.type) {
      case 'map':
        if (!step.transform) throw new Error('Map step requires transform function');
        return data.map(step.transform);

      case 'filter':
        if (!step.condition) throw new Error('Filter step requires condition function');
        return data.filter(step.condition);

      case 'reduce':
        if (!step.reducer) throw new Error('Reduce step requires reducer function');
        return [data.reduce(step.reducer, step.initialValue)];

      case 'sort':
        if (typeof step.sortBy === 'function') {
          return [...data].sort(step.sortBy);
        } else if (typeof step.sortBy === 'string') {
          return [...data].sort((a, b) => {
            const aVal = a[step.sortBy as string];
            const bVal = b[step.sortBy as string];
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
          });
        }
        return data;

      case 'group':
        const groups = new Map<string, any[]>();
        const groupKeyFn = typeof step.groupBy === 'function' 
          ? step.groupBy 
          : (item: any) => item[step.groupBy as string];

        for (const item of data) {
          const key = groupKeyFn(item);
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(item);
        }

        return Array.from(groups.entries()).map(([key, items]) => ({
          key,
          items
        }));

      case 'join':
        if (!step.joinWith || !step.joinOn) {
          throw new Error('Join step requires joinWith and joinOn');
        }
        return this.performJoin(data, step.joinWith, step.joinOn);

      case 'pivot':
        if (!step.pivotOn || !step.pivotValue) {
          throw new Error('Pivot step requires pivotOn and pivotValue');
        }
        return this.performPivot(data, step.pivotOn, step.pivotValue);

      case 'aggregate':
        if (!step.field || !step.aggregation) {
          throw new Error('Aggregate step requires field and aggregation');
        }
        return [this.performAggregation(data, step.field, step.aggregation)];

      case 'custom':
        if (!step.customFunction) {
          throw new Error('Custom step requires customFunction');
        }
        return step.customFunction(data);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private performJoin(left: any[], right: any[], joinKey: string): any[] {
    const rightMap = new Map(right.map(item => [item[joinKey], item]));
    return left.map(leftItem => ({
      ...leftItem,
      joined: rightMap.get(leftItem[joinKey])
    }));
  }

  private performPivot(data: any[], pivotKey: string, valueKey: string): any[] {
    const pivoted: any = {};
    
    for (const item of data) {
      const key = item[pivotKey];
      if (!pivoted[key]) {
        pivoted[key] = {};
      }
      
      for (const [k, v] of Object.entries(item)) {
        if (k !== pivotKey && k !== valueKey) {
          if (!pivoted[key][k]) {
            pivoted[key][k] = [];
          }
          pivoted[key][k].push(v);
        }
      }
      
      pivoted[key][valueKey] = item[valueKey];
    }

    return Object.entries(pivoted).map(([key, values]) => ({
      [pivotKey]: key,
      ...(typeof values === 'object' && values !== null ? values : {})
    }));
  }

  private performAggregation(data: any[], field: string, type: string): any {
    const values = data.map(item => item[field]).filter(v => v !== undefined);
    
    switch (type) {
      case 'sum':
        return { [field]: values.reduce((a, b) => a + b, 0) };
      case 'avg':
        return { [field]: values.reduce((a, b) => a + b, 0) / values.length };
      case 'min':
        return { [field]: Math.min(...values) };
      case 'max':
        return { [field]: Math.max(...values) };
      case 'count':
        return { [field]: values.length };
      default:
        throw new Error(`Unknown aggregation type: ${type}`);
    }
  }

  private validateData(data: any[], schema: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    // Simple validation since DataValidator.validateForm is for HTML forms
    for (const item of data) {
      if (schema && typeof schema === 'object') {
        for (const [key, rules] of Object.entries(schema)) {
          if (rules && item[key] === undefined) {
            errors.push(`Missing required field: ${key}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Pipeline builder methods
  createPipeline(name: string, description?: string): PipelineBuilder {
    return new PipelineBuilder(this, name, description);
  }

  getPipeline(id: string): Pipeline | undefined {
    return this.pipelines.get(id);
  }

  listPipelines(): Array<{ id: string; name: string; description?: string }> {
    return Array.from(this.pipelines.values()).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description
    }));
  }

  deletePipeline(id: string): boolean {
    return this.pipelines.delete(id);
  }

  // Advanced transformation methods
  async chain(data: any[], ...pipelineIds: string[]): Promise<any[]> {
    let result = data;
    
    for (const pipelineId of pipelineIds) {
      const transformResult = await this.execute(pipelineId, result);
      if (!transformResult.success) {
        throw new Error(`Pipeline ${pipelineId} failed: ${transformResult.errors?.[0]?.error}`);
      }
      result = transformResult.data;
    }

    return result;
  }

  async parallel(data: any[], ...pipelineIds: string[]): Promise<any[][]> {
    const promises = pipelineIds.map(id => this.execute(id, data));
    const results = await Promise.all(promises);
    
    return results.map(r => {
      if (!r.success) {
        throw new Error(`Pipeline failed: ${r.errors?.[0]?.error}`);
      }
      return r.data;
    });
  }

  // Export transformed data
  async executeAndExport(
    pipelineId: string,
    data: any[],
    format: 'csv' | 'json' | 'xml',
    filePath?: string
  ): Promise<string> {
    const result = await this.execute(pipelineId, data);
    
    if (!result.success) {
      throw new Error(`Pipeline failed: ${result.errors?.[0]?.error}`);
    }

    if (filePath) {
      await DataExporter.exportToFile(result.data, filePath, { format: format || 'json' });
      return `Data exported to ${filePath}`;
    }

    switch (format) {
      case 'csv':
        return DataExporter.exportToCSV(result.data);
      case 'json':
        return DataExporter.exportToJSON(result.data);
      case 'xml':
        return DataExporter.exportToXML(result.data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Get transformation history
  getHistory(limit: number = 10): typeof this.transformHistory {
    return this.transformHistory.slice(-limit);
  }

  clearHistory(): void {
    this.transformHistory = [];
  }
}

// Pipeline builder for fluent API
export class PipelineBuilder {
  private pipeline: Pipeline;
  private parent: DataTransformationPipeline;

  constructor(parent: DataTransformationPipeline, name: string, description?: string) {
    this.parent = parent;
    this.pipeline = {
      id: `pipeline-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name,
      description,
      steps: []
    };
  }

  map(transform: (item: any) => any, name: string = 'Map'): this {
    this.pipeline.steps.push({ name, type: 'map', transform });
    return this;
  }

  filter(condition: (item: any) => boolean, name: string = 'Filter'): this {
    this.pipeline.steps.push({ name, type: 'filter', condition });
    return this;
  }

  reduce(
    reducer: (acc: any, item: any) => any,
    initialValue: any,
    name: string = 'Reduce'
  ): this {
    this.pipeline.steps.push({ name, type: 'reduce', reducer, initialValue });
    return this;
  }

  sort(sortBy: string | ((a: any, b: any) => number), name: string = 'Sort'): this {
    this.pipeline.steps.push({ name, type: 'sort', sortBy });
    return this;
  }

  group(groupBy: string | ((item: any) => string), name: string = 'Group'): this {
    this.pipeline.steps.push({ name, type: 'group', groupBy });
    return this;
  }

  join(joinWith: any[], joinOn: string, name: string = 'Join'): this {
    this.pipeline.steps.push({ name, type: 'join', joinWith, joinOn });
    return this;
  }

  pivot(pivotOn: string, pivotValue: string, name: string = 'Pivot'): this {
    this.pipeline.steps.push({ name, type: 'pivot', pivotOn, pivotValue });
    return this;
  }

  aggregate(
    field: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    name: string = 'Aggregate'
  ): this {
    this.pipeline.steps.push({ name, type: 'aggregate', field, aggregation });
    return this;
  }

  custom(customFunction: (data: any[]) => any[], name: string = 'Custom'): this {
    this.pipeline.steps.push({ name, type: 'custom', customFunction });
    return this;
  }

  withInputValidation(schema: any): this {
    this.pipeline.inputValidation = schema;
    return this;
  }

  withOutputValidation(schema: any): this {
    this.pipeline.outputValidation = schema;
    return this;
  }

  withErrorHandling(strategy: 'skip' | 'stop' | 'default', defaultValue?: any): this {
    this.pipeline.errorHandling = strategy;
    if (defaultValue !== undefined) {
      this.pipeline.defaultValue = defaultValue;
    }
    return this;
  }

  build(): Pipeline {
    this.parent.registerPipeline(this.pipeline);
    return this.pipeline;
  }

  async execute(data: any[]): Promise<TransformResult> {
    this.build();
    return this.parent.execute(this.pipeline.id, data);
  }
}