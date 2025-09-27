import { PlayClone } from '../index';

interface TestScenario {
  title: string;
  description: string;
  preconditions: string[];
  steps: TestStep[];
  expectedResults: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  dataRequirements?: any;
}

interface TestStep {
  type: 'given' | 'when' | 'then' | 'and' | 'but';
  action: string;
  element?: string;
  data?: any;
  assertion?: string;
}

interface ParsedUserStory {
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  scenarios: TestScenario[];
  metadata?: {
    epic?: string;
    sprint?: string;
    points?: number;
    assignee?: string;
  };
}

export class UserStoryParser {
  private patterns = {
    userStory: /As a (.+?),?\s*I want to (.+?)\s*(?:so that|because) (.+)/i,
    acceptanceCriteria: /(?:acceptance criteria|AC|criteria):\s*([^]+?)(?=\n\n|\n[A-Z]|$)/i,
    scenario: /(?:scenario|test case|example):\s*(.+)/i,
    given: /(?:given|and|with)\s+(.+)/i,
    when: /(?:when|if|after)\s+(.+)/i,
    then: /(?:then|should|must|will)\s+(.+)/i,
    metadata: {
      epic: /epic:\s*(.+)/i,
      sprint: /sprint:\s*(.+)/i,
      points: /(?:story points?|points?):\s*(\d+)/i,
      assignee: /(?:assigned to|assignee):\s*(.+)/i
    }
  };

  private commonActions = {
    navigation: ['navigate', 'go to', 'visit', 'open', 'access'],
    click: ['click', 'tap', 'press', 'select', 'choose'],
    input: ['enter', 'type', 'fill', 'input', 'provide'],
    verification: ['see', 'verify', 'check', 'confirm', 'assert'],
    wait: ['wait', 'pause', 'delay', 'loading'],
    scroll: ['scroll', 'swipe', 'pan'],
    authentication: ['login', 'sign in', 'authenticate', 'logout']
  };

  parseUserStory(storyText: string): ParsedUserStory {
    const story: ParsedUserStory = {
      title: '',
      asA: '',
      iWant: '',
      soThat: '',
      acceptanceCriteria: [],
      scenarios: []
    };

    // Extract user story components
    const storyMatch = storyText.match(this.patterns.userStory);
    if (storyMatch) {
      story.asA = storyMatch[1].trim();
      story.iWant = storyMatch[2].trim();
      story.soThat = storyMatch[3].trim();
      story.title = this.generateTitle(story.iWant);
    }

    // Extract acceptance criteria
    const criteriaMatch = storyText.match(this.patterns.acceptanceCriteria);
    if (criteriaMatch) {
      story.acceptanceCriteria = criteriaMatch[1]
        .split(/\n[-*•]/)
        .map(c => c.trim())
        .filter(c => c.length > 0);
    }

    // Extract metadata
    story.metadata = this.extractMetadata(storyText);

    // Parse scenarios from acceptance criteria
    story.scenarios = this.extractScenarios(storyText);

    // If no explicit scenarios, generate from acceptance criteria
    if (story.scenarios.length === 0 && story.acceptanceCriteria.length > 0) {
      story.scenarios = this.generateScenariosFromCriteria(story.acceptanceCriteria);
    }

    return story;
  }

  parseGherkinScenario(gherkinText: string): TestScenario {
    const lines = gherkinText.split('\n').map(l => l.trim()).filter(l => l);
    const scenario: TestScenario = {
      title: '',
      description: '',
      preconditions: [],
      steps: [],
      expectedResults: [],
      priority: 'medium',
      tags: []
    };

    // Extract scenario title
    const titleMatch = gherkinText.match(/scenario:?\s*(.+)/i);
    if (titleMatch) {
      scenario.title = titleMatch[1].trim();
    }

    // Parse steps
    for (const line of lines) {
      if (line.match(/^given/i)) {
        const match = line.match(this.patterns.given);
        if (match) {
          scenario.steps.push(this.parseStep('given', match[1]));
        }
      } else if (line.match(/^when/i)) {
        const match = line.match(this.patterns.when);
        if (match) {
          scenario.steps.push(this.parseStep('when', match[1]));
        }
      } else if (line.match(/^then/i)) {
        const match = line.match(this.patterns.then);
        if (match) {
          scenario.steps.push(this.parseStep('then', match[1]));
        }
      } else if (line.match(/^and/i)) {
        const lastStep = scenario.steps[scenario.steps.length - 1];
        if (lastStep) {
          scenario.steps.push(this.parseStep(lastStep.type, line.replace(/^and\s+/i, '')));
        }
      }
    }

    // Extract tags
    const tagMatch = gherkinText.match(/@(\w+)/g);
    if (tagMatch) {
      scenario.tags = tagMatch.map(t => t.substring(1));
      
      // Set priority based on tags
      if (scenario.tags.includes('critical')) scenario.priority = 'critical';
      else if (scenario.tags.includes('high')) scenario.priority = 'high';
      else if (scenario.tags.includes('low')) scenario.priority = 'low';
    }

    return scenario;
  }

  extractIntentAndEntities(text: string): { intent: string; entities: Record<string, any> } {
    const result = {
      intent: '',
      entities: {} as Record<string, any>
    };

    // Identify intent based on action keywords
    for (const [category, keywords] of Object.entries(this.commonActions)) {
      if (keywords.some(kw => text.toLowerCase().includes(kw))) {
        result.intent = category;
        break;
      }
    }

    // Extract entities
    // URLs
    const urlMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/);
    if (urlMatch) result.entities.url = urlMatch[0];

    // Quoted text
    const quotedMatch = text.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedMatch) {
      result.entities.text = quotedMatch.map(q => q.replace(/["']/g, ''));
    }

    // Form fields
    const fieldMatch = text.match(/(?:field|input|textbox|button|link)\s+(?:named?|called?|labeled?)?\s*"?([^"]+)"?/i);
    if (fieldMatch) result.entities.field = fieldMatch[1];

    // Numbers
    const numberMatch = text.match(/\d+/g);
    if (numberMatch) result.entities.numbers = numberMatch.map(n => parseInt(n));

    // Email
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) result.entities.email = emailMatch[0];

    return result;
  }

  generateTestOutline(story: ParsedUserStory): string {
    let outline = `# Test Suite: ${story.title}\n\n`;
    outline += `## User Story\n`;
    outline += `As a ${story.asA}, I want to ${story.iWant} so that ${story.soThat}\n\n`;
    
    outline += `## Test Scenarios\n\n`;
    
    for (const scenario of story.scenarios) {
      outline += `### ${scenario.title}\n`;
      outline += `Priority: ${scenario.priority}\n`;
      if (scenario.tags.length > 0) {
        outline += `Tags: ${scenario.tags.join(', ')}\n`;
      }
      outline += `\n`;
      
      outline += `#### Steps:\n`;
      for (const step of scenario.steps) {
        outline += `- ${step.type.toUpperCase()}: ${step.action}\n`;
      }
      outline += `\n`;
    }
    
    return outline;
  }

  inferTestData(story: ParsedUserStory): any {
    const testData: any = {
      users: [],
      forms: {},
      expectedValues: {}
    };

    // Infer user types from the story
    if (story.asA) {
      testData.users.push({
        type: story.asA,
        credentials: this.generateCredentials(story.asA)
      });
    }

    // Extract form data from scenarios
    for (const scenario of story.scenarios) {
      for (const step of scenario.steps) {
        const { entities } = this.extractIntentAndEntities(step.action);
        
        if (entities.text && entities.field) {
          if (!testData.forms[scenario.title]) {
            testData.forms[scenario.title] = {};
          }
          testData.forms[scenario.title][entities.field] = entities.text[0];
        }
        
        if (step.type === 'then' && entities.text) {
          testData.expectedValues[scenario.title] = entities.text;
        }
      }
    }

    return testData;
  }

  suggestAdditionalScenarios(story: ParsedUserStory): TestScenario[] {
    const suggestions: TestScenario[] = [];
    
    // Suggest negative test cases
    for (const scenario of story.scenarios) {
      if (!scenario.title.toLowerCase().includes('error') && 
          !scenario.title.toLowerCase().includes('invalid')) {
        suggestions.push(this.generateNegativeScenario(scenario));
      }
    }
    
    // Suggest edge cases
    if (story.iWant.includes('form') || story.iWant.includes('input')) {
      suggestions.push(this.generateEdgeCaseScenario('Empty form submission'));
      suggestions.push(this.generateEdgeCaseScenario('Special characters in input'));
    }
    
    // Suggest performance scenarios
    if (story.scenarios.length > 0) {
      suggestions.push(this.generatePerformanceScenario(story.scenarios[0]));
    }
    
    return suggestions;
  }

  private parseStep(type: TestStep['type'], action: string): TestStep {
    const step: TestStep = { type, action: action.trim() };
    
    // Extract element selector if present
    const elementMatch = action.match(/(?:on|in|at|the)\s+["']?([^"']+)["']?\s+(?:button|link|field|input|page)/i);
    if (elementMatch) {
      step.element = elementMatch[1];
    }
    
    // Extract data if present
    const dataMatch = action.match(/(?:with|using|entering|typing)\s+["']?([^"']+)["']?/i);
    if (dataMatch) {
      step.data = dataMatch[1];
    }
    
    // Extract assertion if it's a 'then' step
    if (type === 'then') {
      const assertionMatch = action.match(/(?:should|must|will)\s+(.+)/i);
      if (assertionMatch) {
        step.assertion = assertionMatch[1];
      }
    }
    
    return step;
  }

  private extractMetadata(text: string): ParsedUserStory['metadata'] {
    const metadata: ParsedUserStory['metadata'] = {};
    
    for (const [key, pattern] of Object.entries(this.patterns.metadata)) {
      const match = text.match(pattern);
      if (match) {
        if (key === 'points') {
          metadata.points = parseInt(match[1]);
        } else if (key === 'epic') {
          metadata.epic = match[1].trim();
        } else if (key === 'sprint') {
          metadata.sprint = match[1].trim();
        } else if (key === 'assignee') {
          metadata.assignee = match[1].trim();
        }
      }
    }
    
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private extractScenarios(text: string): TestScenario[] {
    const scenarios: TestScenario[] = [];
    const scenarioBlocks = text.split(/scenario:?\s+/i).slice(1);
    
    for (const block of scenarioBlocks) {
      const scenario = this.parseGherkinScenario(`Scenario: ${block}`);
      scenarios.push(scenario);
    }
    
    return scenarios;
  }

  private generateScenariosFromCriteria(criteria: string[]): TestScenario[] {
    return criteria.map((criterion, index) => ({
      title: `Scenario ${index + 1}: ${this.extractScenarioTitle(criterion)}`,
      description: criterion,
      preconditions: [],
      steps: this.generateStepsFromCriterion(criterion),
      expectedResults: [criterion],
      priority: 'medium',
      tags: this.extractTags(criterion)
    }));
  }

  private extractScenarioTitle(criterion: string): string {
    // Extract a concise title from the criterion
    const words = criterion.split(' ').slice(0, 5);
    return words.join(' ') + (criterion.split(' ').length > 5 ? '...' : '');
  }

  private generateStepsFromCriterion(criterion: string): TestStep[] {
    const steps: TestStep[] = [];
    const { intent, entities } = this.extractIntentAndEntities(criterion);
    
    // Generate basic steps based on intent
    if (intent === 'navigation' && entities.url) {
      steps.push({ type: 'given', action: 'User is on the home page' });
      steps.push({ type: 'when', action: `User navigates to ${entities.url}` });
    } else if (intent === 'click' && entities.text) {
      steps.push({ type: 'when', action: `User clicks on "${entities.text[0]}"` });
    } else if (intent === 'input' && entities.field) {
      steps.push({ type: 'when', action: `User enters data in "${entities.field}" field` });
    }
    
    // Add a default then step
    steps.push({ type: 'then', action: criterion });
    
    return steps;
  }

  private extractTags(text: string): string[] {
    const tags: string[] = [];
    
    // Extract functional area
    if (text.match(/login|auth|sign/i)) tags.push('authentication');
    if (text.match(/form|input|submit/i)) tags.push('forms');
    if (text.match(/search|find|filter/i)) tags.push('search');
    if (text.match(/cart|checkout|payment/i)) tags.push('ecommerce');
    if (text.match(/upload|download|file/i)) tags.push('fileHandling');
    
    return tags;
  }

  private generateTitle(iWant: string): string {
    // Generate a concise title from the "I want" statement
    return iWant
      .replace(/^to\s+/i, '')
      .split(' ')
      .slice(0, 5)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private generateCredentials(userType: string): any {
    const credentials: any = {};
    
    if (userType.toLowerCase().includes('admin')) {
      credentials.username = 'admin@test.com';
      credentials.password = 'Admin123!';
      credentials.role = 'admin';
    } else if (userType.toLowerCase().includes('customer') || userType.toLowerCase().includes('user')) {
      credentials.username = 'user@test.com';
      credentials.password = 'User123!';
      credentials.role = 'user';
    } else {
      credentials.username = `${userType.toLowerCase()}@test.com`;
      credentials.password = 'Test123!';
      credentials.role = userType.toLowerCase();
    }
    
    return credentials;
  }

  private generateNegativeScenario(positiveScenario: TestScenario): TestScenario {
    return {
      title: `Negative: ${positiveScenario.title}`,
      description: `Test error handling for ${positiveScenario.title}`,
      preconditions: positiveScenario.preconditions,
      steps: [
        ...positiveScenario.steps.slice(0, -1),
        {
          type: 'when',
          action: 'User provides invalid input'
        },
        {
          type: 'then',
          action: 'System should display appropriate error message'
        }
      ],
      expectedResults: ['Error message is displayed', 'System handles error gracefully'],
      priority: 'medium',
      tags: [...positiveScenario.tags, 'negative', 'errorHandling']
    };
  }

  private generateEdgeCaseScenario(title: string): TestScenario {
    return {
      title: `Edge Case: ${title}`,
      description: `Test edge case scenario for ${title}`,
      preconditions: ['System is in normal state'],
      steps: [
        { type: 'given', action: 'User is on the application' },
        { type: 'when', action: `User performs ${title.toLowerCase()}` },
        { type: 'then', action: 'System should handle the edge case appropriately' }
      ],
      expectedResults: ['No system crash', 'Appropriate response or error message'],
      priority: 'low',
      tags: ['edgeCase', 'robustness']
    };
  }

  private generatePerformanceScenario(baseScenario: TestScenario): TestScenario {
    return {
      title: `Performance: ${baseScenario.title}`,
      description: `Test performance aspects of ${baseScenario.title}`,
      preconditions: ['System is under normal load'],
      steps: [
        ...baseScenario.steps,
        { type: 'then', action: 'Response time should be under 3 seconds' },
        { type: 'and', action: 'System resources should remain stable' }
      ],
      expectedResults: ['Response within acceptable time', 'No memory leaks', 'CPU usage normal'],
      priority: 'medium',
      tags: [...baseScenario.tags, 'performance', 'nonfunctional']
    };
  }
}