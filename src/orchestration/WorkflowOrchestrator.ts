import { PlayClone } from '../PlayClone';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'condition' | 'loop' | 'parallel' | 'approval' | 'webhook';
  action?: string;
  params?: any;
  condition?: WorkflowCondition;
  loop?: WorkflowLoop;
  parallel?: WorkflowParallel;
  approval?: WorkflowApproval;
  webhook?: WorkflowWebhook;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  continueOnError?: boolean;
  outputs?: Record<string, any>;
}

export interface WorkflowCondition {
  expression: string;
  trueBranch: WorkflowStep[];
  falseBranch?: WorkflowStep[];
}

export interface WorkflowLoop {
  type: 'for' | 'while' | 'forEach';
  collection?: string;
  variable?: string;
  condition?: string;
  maxIterations?: number;
  steps: WorkflowStep[];
}

export interface WorkflowParallel {
  maxConcurrency?: number;
  waitForAll?: boolean;
  steps: WorkflowStep[];
}

export interface WorkflowApproval {
  approvers: string[];
  timeout?: number;
  message?: string;
  requireAll?: boolean;
}

export interface WorkflowWebhook {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  waitForResponse?: boolean;
  timeout?: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  delay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version?: string;
  triggers?: WorkflowTrigger[];
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  steps: WorkflowStep[];
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  schedule?: string;
  webhook?: WorkflowWebhook;
  event?: string;
  conditions?: string[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  variables: Record<string, any>;
  outputs: Record<string, any>;
  errors: Array<{ step: string; error: string; timestamp: Date }>;
  history: Array<ExecutionHistoryItem>;
}

export interface ExecutionHistoryItem {
  stepId: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  inputs?: any;
  outputs?: any;
  error?: string;
}

export class WorkflowOrchestrator extends EventEmitter {
  private playclone: PlayClone;
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private webhookHandlers: Map<string, (data: any) => void> = new Map();
  private approvalCallbacks: Map<string, (approved: boolean) => void> = new Map();
  private workflowDir: string;

  constructor(playclone: PlayClone, workflowDir: string = './workflows') {
    super();
    this.playclone = playclone;
    this.workflowDir = workflowDir;
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.workflowDir, { recursive: true });
      await this.loadWorkflows();
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async loadWorkflows(): Promise<void> {
    try {
      const files = await fs.readdir(this.workflowDir);
      const workflowFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.yaml'));
      
      for (const file of workflowFiles) {
        const content = await fs.readFile(path.join(this.workflowDir, file), 'utf-8');
        const workflow = file.endsWith('.json') 
          ? JSON.parse(content)
          : this.parseYaml(content);
        
        this.workflows.set(workflow.id, workflow);
        this.setupTriggers(workflow);
      }
      
      this.emit('workflowsLoaded', this.workflows.size);
    } catch (error) {
      this.emit('error', error);
    }
  }

  public registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    this.setupTriggers(workflow);
    this.emit('workflowRegistered', workflow.id);
  }

  public async executeWorkflow(
    workflowId: string,
    inputs?: Record<string, any>
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      startTime: new Date(),
      variables: { ...workflow.variables, ...inputs },
      outputs: {},
      errors: [],
      history: []
    };

    this.executions.set(executionId, execution);
    this.emit('executionStarted', executionId);

    try {
      for (const step of workflow.steps) {
        execution.currentStep = step.id;
        await this.executeStep(step, execution);
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.outputs = workflow.outputs 
        ? this.evaluateOutputs(workflow.outputs, execution.variables)
        : execution.variables;
      
      this.emit('executionCompleted', executionId);
    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errors.push({
        step: execution.currentStep || 'unknown',
        error: error.message,
        timestamp: new Date()
      });
      
      this.emit('executionFailed', executionId, error);
    }

    return execution;
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const historyItem: ExecutionHistoryItem = {
      stepId: step.id,
      status: 'started',
      startTime: new Date(),
      inputs: step.params
    };
    
    execution.history.push(historyItem);
    this.emit('stepStarted', execution.id, step.id);

    try {
      let result: any;

      switch (step.type) {
        case 'action':
          result = await this.executeAction(step, execution);
          break;
        case 'condition':
          result = await this.executeCondition(step, execution);
          break;
        case 'loop':
          result = await this.executeLoop(step, execution);
          break;
        case 'parallel':
          result = await this.executeParallel(step, execution);
          break;
        case 'approval':
          result = await this.executeApproval(step, execution);
          break;
        case 'webhook':
          result = await this.executeWebhook(step, execution);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      if (step.outputs) {
        Object.assign(execution.variables, this.mapOutputs(step.outputs, result));
      }

      historyItem.status = 'completed';
      historyItem.endTime = new Date();
      historyItem.outputs = result;
      
      this.emit('stepCompleted', execution.id, step.id);
    } catch (error: any) {
      historyItem.status = 'failed';
      historyItem.endTime = new Date();
      historyItem.error = error.message;

      if (step.retryPolicy) {
        await this.retryStep(step, execution, step.retryPolicy);
      } else if (!step.continueOnError) {
        throw error;
      }
      
      this.emit('stepFailed', execution.id, step.id, error);
    }
  }

  private async executeAction(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    const action = step.action!;
    const params = this.resolveVariables(step.params, execution.variables);
    
    switch (action) {
      case 'navigate':
        return await this.playclone.navigate(params.url);
      case 'click':
        return await this.playclone.click(params.selector);
      case 'fill':
        return await this.playclone.fill(params.selector, params.value);
      case 'getText':
        return await this.playclone.getText(params.selector);
      case 'getLinks':
        return await this.playclone.getLinks();
      case 'screenshot':
        return await this.playclone.screenshot(params);
      case 'wait':
        return await new Promise(resolve => setTimeout(resolve, params.duration || 1000));
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async executeCondition(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    const condition = step.condition!;
    const result = this.evaluateExpression(condition.expression, execution.variables);
    
    const branch = result ? condition.trueBranch : (condition.falseBranch || []);
    
    for (const subStep of branch) {
      await this.executeStep(subStep, execution);
    }
    
    return { conditionResult: result };
  }

  private async executeLoop(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    const loop = step.loop!;
    const results: any[] = [];
    let iterations = 0;
    
    switch (loop.type) {
      case 'for':
        const collection = this.resolveVariables(loop.collection, execution.variables);
        const items = Array.isArray(collection) ? collection : Object.values(collection);
        
        for (const item of items) {
          if (loop.maxIterations && iterations >= loop.maxIterations) break;
          
          if (loop.variable) {
            execution.variables[loop.variable] = item;
          }
          
          for (const subStep of loop.steps) {
            const result = await this.executeStep(subStep, execution);
            results.push(result);
          }
          
          iterations++;
        }
        break;
        
      case 'while':
        while (this.evaluateExpression(loop.condition!, execution.variables)) {
          if (loop.maxIterations && iterations >= loop.maxIterations) break;
          
          for (const subStep of loop.steps) {
            const result = await this.executeStep(subStep, execution);
            results.push(result);
          }
          
          iterations++;
        }
        break;
        
      case 'forEach':
        const forEachCollection = this.resolveVariables(loop.collection, execution.variables);
        const forEachItems = Array.isArray(forEachCollection) 
          ? forEachCollection 
          : Object.entries(forEachCollection);
        
        for (const [key, value] of forEachItems.entries()) {
          if (loop.maxIterations && iterations >= loop.maxIterations) break;
          
          if (loop.variable) {
            execution.variables[loop.variable] = { key, value };
          }
          
          for (const subStep of loop.steps) {
            const result = await this.executeStep(subStep, execution);
            results.push(result);
          }
          
          iterations++;
        }
        break;
    }
    
    return { iterations, results };
  }

  private async executeParallel(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    const parallel = step.parallel!;
    const maxConcurrency = parallel.maxConcurrency || Infinity;
    const waitForAll = parallel.waitForAll !== false;
    
    const results: any[] = [];
    const errors: any[] = [];
    
    const executeInBatches = async (steps: WorkflowStep[]) => {
      for (let i = 0; i < steps.length; i += maxConcurrency) {
        const batch = steps.slice(i, i + maxConcurrency);
        const promises = batch.map(async (subStep) => {
          try {
            return await this.executeStep(subStep, execution);
          } catch (error) {
            errors.push({ step: subStep.id, error });
            if (!waitForAll) throw error;
            return null;
          }
        });
        
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }
    };
    
    await executeInBatches(parallel.steps);
    
    if (errors.length > 0 && waitForAll) {
      throw new Error(`Parallel execution failed: ${errors.length} steps failed`);
    }
    
    return { results, errors };
  }

  private async executeApproval(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    const approval = step.approval!;
    execution.status = 'waiting';
    
    this.emit('approvalRequired', execution.id, step.id, approval);
    
    return new Promise((resolve, reject) => {
      const timeoutId = approval.timeout 
        ? setTimeout(() => {
            execution.status = 'running';
            reject(new Error('Approval timeout'));
          }, approval.timeout)
        : null;
      
      const callbackId = `${execution.id}-${step.id}`;
      this.approvalCallbacks.set(callbackId, (approved: boolean) => {
        if (timeoutId) clearTimeout(timeoutId);
        execution.status = 'running';
        
        if (approved) {
          resolve({ approved: true, timestamp: new Date() });
        } else {
          reject(new Error('Approval denied'));
        }
        
        this.approvalCallbacks.delete(callbackId);
      });
    });
  }

  private async executeWebhook(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    const webhook = step.webhook!;
    const resolvedBody = this.resolveVariables(webhook.body, execution.variables);
    
    const response = await fetch(webhook.url, {
      method: webhook.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...webhook.headers
      },
      body: JSON.stringify(resolvedBody)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
    
    if (webhook.waitForResponse) {
      return await response.json();
    }
    
    return { status: response.status, statusText: response.statusText };
  }

  private async retryStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    policy: RetryPolicy
  ): Promise<void> {
    let attempt = 0;
    let delay = policy.delay || 1000;
    
    while (attempt < policy.maxAttempts) {
      attempt++;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        await this.executeStep(step, execution);
        return;
      } catch (error) {
        if (attempt === policy.maxAttempts) {
          throw error;
        }
        
        delay = Math.min(
          delay * (policy.backoffMultiplier || 2),
          policy.maxDelay || 60000
        );
      }
    }
  }

  private setupTriggers(workflow: Workflow): void {
    if (!workflow.triggers) return;
    
    for (const trigger of workflow.triggers) {
      switch (trigger.type) {
        case 'schedule':
          this.setupScheduleTrigger(workflow.id, trigger);
          break;
        case 'webhook':
          this.setupWebhookTrigger(workflow.id, trigger);
          break;
        case 'event':
          this.setupEventTrigger(workflow.id, trigger);
          break;
      }
    }
  }

  private setupScheduleTrigger(workflowId: string, trigger: WorkflowTrigger): void {
    if (!trigger.schedule) return;
    
    const cronPattern = this.parseCronPattern(trigger.schedule);
    const intervalMs = this.calculateInterval(cronPattern);
    
    const jobId = `${workflowId}-schedule`;
    const existing = this.scheduledJobs.get(jobId);
    if (existing) clearInterval(existing);
    
    const job = setInterval(() => {
      this.executeWorkflow(workflowId).catch(error => {
        this.emit('error', error);
      });
    }, intervalMs);
    
    this.scheduledJobs.set(jobId, job);
  }

  private setupWebhookTrigger(workflowId: string, trigger: WorkflowTrigger): void {
    if (!trigger.webhook) return;
    
    const handlerId = `${workflowId}-webhook`;
    this.webhookHandlers.set(handlerId, (data: any) => {
      this.executeWorkflow(workflowId, data).catch(error => {
        this.emit('error', error);
      });
    });
  }

  private setupEventTrigger(workflowId: string, trigger: WorkflowTrigger): void {
    if (!trigger.event) return;
    
    this.on(trigger.event, (data: any) => {
      if (trigger.conditions && !this.evaluateConditions(trigger.conditions, data)) {
        return;
      }
      
      this.executeWorkflow(workflowId, data).catch(error => {
        this.emit('error', error);
      });
    });
  }

  public approveStep(executionId: string, stepId: string, approved: boolean): void {
    const callbackId = `${executionId}-${stepId}`;
    const callback = this.approvalCallbacks.get(callbackId);
    
    if (callback) {
      callback(approved);
    }
  }

  public cancelExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      this.emit('executionCancelled', executionId);
    }
  }

  public getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  public getExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    
    if (workflowId) {
      return executions.filter(e => e.workflowId === workflowId);
    }
    
    return executions;
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public async saveWorkflow(workflow: Workflow): Promise<void> {
    const filename = `${workflow.id}.json`;
    const filepath = path.join(this.workflowDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(workflow, null, 2));
    this.workflows.set(workflow.id, workflow);
    
    this.emit('workflowSaved', workflow.id);
  }

  public async deleteWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    const filename = `${workflowId}.json`;
    const filepath = path.join(this.workflowDir, filename);
    
    try {
      await fs.unlink(filepath);
    } catch (error) {
      // File might not exist
    }
    
    this.workflows.delete(workflowId);
    
    // Clean up triggers
    const jobId = `${workflowId}-schedule`;
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      clearInterval(job);
      this.scheduledJobs.delete(jobId);
    }
    
    this.webhookHandlers.delete(`${workflowId}-webhook`);
    
    this.emit('workflowDeleted', workflowId);
  }

  public cleanup(): void {
    // Clear all scheduled jobs
    for (const job of this.scheduledJobs.values()) {
      clearInterval(job);
    }
    this.scheduledJobs.clear();
    
    // Clear all handlers
    this.webhookHandlers.clear();
    this.approvalCallbacks.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
  }

  private resolveVariables(value: any, variables: Record<string, any>): any {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const varName = value.slice(2, -2).trim();
      return this.getNestedValue(variables, varName);
    }
    
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(item => this.resolveVariables(item, variables));
      }
      
      const resolved: any = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveVariables(val, variables);
      }
      return resolved;
    }
    
    return value;
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    
    return current;
  }

  private evaluateExpression(expression: string, variables: Record<string, any>): boolean {
    try {
      // Simple expression evaluation (can be enhanced with a proper expression parser)
      const resolved = this.resolveVariables(expression, variables);
      
      if (typeof resolved === 'boolean') return resolved;
      if (typeof resolved === 'string') {
        // Handle simple comparisons
        if (resolved.includes('==')) {
          const [left, right] = resolved.split('==').map(s => s.trim());
          return this.resolveVariables(left, variables) === this.resolveVariables(right, variables);
        }
        if (resolved.includes('!=')) {
          const [left, right] = resolved.split('!=').map(s => s.trim());
          return this.resolveVariables(left, variables) !== this.resolveVariables(right, variables);
        }
        if (resolved.includes('>')) {
          const [left, right] = resolved.split('>').map(s => s.trim());
          return this.resolveVariables(left, variables) > this.resolveVariables(right, variables);
        }
        if (resolved.includes('<')) {
          const [left, right] = resolved.split('<').map(s => s.trim());
          return this.resolveVariables(left, variables) < this.resolveVariables(right, variables);
        }
      }
      
      return Boolean(resolved);
    } catch (error) {
      return false;
    }
  }

  private evaluateConditions(conditions: string[], data: any): boolean {
    return conditions.every(condition => this.evaluateExpression(condition, data));
  }

  private mapOutputs(outputs: Record<string, any>, result: any): Record<string, any> {
    const mapped: Record<string, any> = {};
    
    for (const [key, path] of Object.entries(outputs)) {
      if (typeof path === 'string') {
        mapped[key] = this.getNestedValue(result, path);
      } else {
        mapped[key] = path;
      }
    }
    
    return mapped;
  }

  private evaluateOutputs(
    outputs: Record<string, any>,
    variables: Record<string, any>
  ): Record<string, any> {
    return this.resolveVariables(outputs, variables);
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseCronPattern(pattern: string): any {
    // Simple cron pattern parser (can be enhanced with a proper library)
    const parts = pattern.split(' ');
    return {
      minute: parts[0],
      hour: parts[1],
      day: parts[2],
      month: parts[3],
      weekday: parts[4]
    };
  }

  private calculateInterval(cronPattern: any): number {
    // Simple interval calculation (can be enhanced)
    if (cronPattern.minute === '*') return 60 * 1000; // Every minute
    if (cronPattern.hour === '*') return 60 * 60 * 1000; // Every hour
    return 24 * 60 * 60 * 1000; // Daily
  }

  private parseYaml(content: string): any {
    // Simple YAML parser (would need a proper library like js-yaml)
    // For now, just throw an error
    throw new Error('YAML parsing not implemented. Use JSON format.');
  }
}