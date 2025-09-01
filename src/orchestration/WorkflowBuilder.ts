import {
  Workflow,
  WorkflowStep,
  WorkflowCondition,
  WorkflowLoop,
  WorkflowParallel,
  WorkflowApproval,
  WorkflowWebhook,
  WorkflowTrigger,
  RetryPolicy
} from './WorkflowOrchestrator';

export class WorkflowBuilder {
  private workflow: Workflow;
  private currentStep: WorkflowStep | null = null;
  private stepStack: WorkflowStep[] = [];

  constructor(id: string, name: string) {
    this.workflow = {
      id,
      name,
      steps: [],
      variables: {},
      inputs: {},
      outputs: {}
    };
  }

  public description(description: string): this {
    this.workflow.description = description;
    return this;
  }

  public version(version: string): this {
    this.workflow.version = version;
    return this;
  }

  public input(name: string, defaultValue?: any): this {
    this.workflow.inputs![name] = defaultValue;
    return this;
  }

  public output(name: string, expression: string): this {
    this.workflow.outputs![name] = expression;
    return this;
  }

  public variable(name: string, value: any): this {
    this.workflow.variables![name] = value;
    return this;
  }

  public trigger(trigger: WorkflowTrigger): this {
    if (!this.workflow.triggers) {
      this.workflow.triggers = [];
    }
    this.workflow.triggers.push(trigger);
    return this;
  }

  public scheduleTrigger(cronPattern: string): this {
    return this.trigger({
      type: 'schedule',
      schedule: cronPattern
    });
  }

  public webhookTrigger(url: string, method: string = 'POST'): this {
    return this.trigger({
      type: 'webhook',
      webhook: {
        url,
        method
      }
    });
  }

  public eventTrigger(eventName: string, conditions?: string[]): this {
    return this.trigger({
      type: 'event',
      event: eventName,
      conditions
    });
  }

  public action(id: string, name: string, action: string, params?: any): this {
    const step: WorkflowStep = {
      id,
      name,
      type: 'action',
      action,
      params
    };
    
    this.addStep(step);
    return this;
  }

  public navigate(id: string, url: string): this {
    return this.action(id, `Navigate to ${url}`, 'navigate', { url });
  }

  public click(id: string, selector: string): this {
    return this.action(id, `Click ${selector}`, 'click', { selector });
  }

  public fill(id: string, selector: string, value: string): this {
    return this.action(id, `Fill ${selector}`, 'fill', { selector, value });
  }

  public getText(id: string, selector: string): this {
    return this.action(id, `Get text from ${selector}`, 'getText', { selector });
  }

  public screenshot(id: string, options?: any): this {
    return this.action(id, 'Take screenshot', 'screenshot', options);
  }

  public wait(id: string, duration: number): this {
    return this.action(id, `Wait ${duration}ms`, 'wait', { duration });
  }

  public condition(
    id: string,
    name: string,
    expression: string
  ): ConditionBuilder {
    const step: WorkflowStep = {
      id,
      name,
      type: 'condition',
      condition: {
        expression,
        trueBranch: [],
        falseBranch: []
      }
    };
    
    this.addStep(step);
    return new ConditionBuilder(this, step);
  }

  public loop(id: string, name: string): LoopBuilder {
    const step: WorkflowStep = {
      id,
      name,
      type: 'loop',
      loop: {
        type: 'for',
        steps: []
      }
    };
    
    this.addStep(step);
    return new LoopBuilder(this, step);
  }

  public parallel(id: string, name: string): ParallelBuilder {
    const step: WorkflowStep = {
      id,
      name,
      type: 'parallel',
      parallel: {
        steps: []
      }
    };
    
    this.addStep(step);
    return new ParallelBuilder(this, step);
  }

  public approval(
    id: string,
    name: string,
    approvers: string[],
    message?: string
  ): this {
    const step: WorkflowStep = {
      id,
      name,
      type: 'approval',
      approval: {
        approvers,
        message
      }
    };
    
    this.addStep(step);
    return this;
  }

  public webhook(
    id: string,
    name: string,
    url: string,
    body?: any
  ): this {
    const step: WorkflowStep = {
      id,
      name,
      type: 'webhook',
      webhook: {
        url,
        body
      }
    };
    
    this.addStep(step);
    return this;
  }

  public retry(policy: RetryPolicy): this {
    if (this.currentStep) {
      this.currentStep.retryPolicy = policy;
    }
    return this;
  }

  public timeout(ms: number): this {
    if (this.currentStep) {
      this.currentStep.timeout = ms;
    }
    return this;
  }

  public continueOnError(value: boolean = true): this {
    if (this.currentStep) {
      this.currentStep.continueOnError = value;
    }
    return this;
  }

  public outputs(outputs: Record<string, any>): this {
    if (this.currentStep) {
      this.currentStep.outputs = outputs;
    }
    return this;
  }

  public build(): Workflow {
    return this.workflow;
  }

  private addStep(step: WorkflowStep): void {
    this.currentStep = step;
    
    if (this.stepStack.length > 0) {
      const parent = this.stepStack[this.stepStack.length - 1];
      
      if (parent.type === 'condition' && parent.condition) {
        // Steps are added to branches via ConditionBuilder
      } else if (parent.type === 'loop' && parent.loop) {
        parent.loop.steps.push(step);
      } else if (parent.type === 'parallel' && parent.parallel) {
        parent.parallel.steps.push(step);
      }
    } else {
      this.workflow.steps.push(step);
    }
  }

  public pushContext(step: WorkflowStep): void {
    this.stepStack.push(step);
  }

  public popContext(): void {
    this.stepStack.pop();
  }
}

export class ConditionBuilder {
  constructor(
    private builder: WorkflowBuilder,
    private step: WorkflowStep
  ) {}

  public then(fn: (builder: WorkflowBuilder) => void): this {
    this.builder.pushContext(this.step);
    const branchBuilder = new BranchBuilder(
      this.builder,
      this.step.condition!.trueBranch
    );
    fn(branchBuilder as any);
    this.builder.popContext();
    return this;
  }

  public else(fn: (builder: WorkflowBuilder) => void): this {
    this.step.condition!.falseBranch = [];
    this.builder.pushContext(this.step);
    const branchBuilder = new BranchBuilder(
      this.builder,
      this.step.condition!.falseBranch
    );
    fn(branchBuilder as any);
    this.builder.popContext();
    return this;
  }

  public end(): WorkflowBuilder {
    return this.builder;
  }
}

export class LoopBuilder {
  constructor(
    private builder: WorkflowBuilder,
    private step: WorkflowStep
  ) {}

  public forEach(collection: string, variable?: string): this {
    this.step.loop!.type = 'forEach';
    this.step.loop!.collection = collection;
    this.step.loop!.variable = variable;
    return this;
  }

  public while(condition: string): this {
    this.step.loop!.type = 'while';
    this.step.loop!.condition = condition;
    return this;
  }

  public for(collection: string, variable?: string): this {
    this.step.loop!.type = 'for';
    this.step.loop!.collection = collection;
    this.step.loop!.variable = variable;
    return this;
  }

  public maxIterations(max: number): this {
    this.step.loop!.maxIterations = max;
    return this;
  }

  public do(fn: (builder: WorkflowBuilder) => void): this {
    this.builder.pushContext(this.step);
    const loopBuilder = new BranchBuilder(
      this.builder,
      this.step.loop!.steps
    );
    fn(loopBuilder as any);
    this.builder.popContext();
    return this;
  }

  public end(): WorkflowBuilder {
    return this.builder;
  }
}

export class ParallelBuilder {
  constructor(
    private builder: WorkflowBuilder,
    private step: WorkflowStep
  ) {}

  public maxConcurrency(max: number): this {
    this.step.parallel!.maxConcurrency = max;
    return this;
  }

  public waitForAll(value: boolean = true): this {
    this.step.parallel!.waitForAll = value;
    return this;
  }

  public add(fn: (builder: WorkflowBuilder) => void): this {
    this.builder.pushContext(this.step);
    const parallelBuilder = new BranchBuilder(
      this.builder,
      this.step.parallel!.steps
    );
    fn(parallelBuilder as any);
    this.builder.popContext();
    return this;
  }

  public end(): WorkflowBuilder {
    return this.builder;
  }
}

class BranchBuilder {
  constructor(
    private builder: WorkflowBuilder,
    private steps: WorkflowStep[]
  ) {}

  public action(id: string, name: string, action: string, params?: any): this {
    const step: WorkflowStep = {
      id,
      name,
      type: 'action',
      action,
      params
    };
    this.steps.push(step);
    return this;
  }

  public navigate(id: string, url: string): this {
    return this.action(id, `Navigate to ${url}`, 'navigate', { url });
  }

  public click(id: string, selector: string): this {
    return this.action(id, `Click ${selector}`, 'click', { selector });
  }

  public fill(id: string, selector: string, value: string): this {
    return this.action(id, `Fill ${selector}`, 'fill', { selector, value });
  }

  public getText(id: string, selector: string): this {
    return this.action(id, `Get text from ${selector}`, 'getText', { selector });
  }

  public wait(id: string, duration: number): this {
    return this.action(id, `Wait ${duration}ms`, 'wait', { duration });
  }
}