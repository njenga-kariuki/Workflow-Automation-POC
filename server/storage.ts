import { 
  users, type User, type InsertUser,
  workflows, type Workflow, type InsertWorkflow, type UpdateWorkflow,
  type BlockStructure
} from "@shared/schema";

// Storage interface for the app
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Workflow methods
  getWorkflow(id: number): Promise<Workflow | undefined>;
  listWorkflows(): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflowStatus(id: number, status: string): Promise<Workflow | undefined>;
  updateWorkflowRawExtraction(id: number, rawExtraction: any): Promise<Workflow | undefined>;
  updateWorkflowOrganizedData(id: number, organizedWorkflow: any): Promise<Workflow | undefined>;
  updateWorkflowBlockStructure(id: number, blockStructure: BlockStructure): Promise<Workflow | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private workflows: Map<number, Workflow>;
  private userIdCounter: number;
  private workflowIdCounter: number;

  constructor() {
    this.users = new Map();
    this.workflows = new Map();
    this.userIdCounter = 1;
    this.workflowIdCounter = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Workflow methods
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    return this.workflows.get(id);
  }

  async listWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values());
  }

  async createWorkflow(insertWorkflow: InsertWorkflow): Promise<Workflow> {
    const id = this.workflowIdCounter++;
    const now = new Date();
    
    const workflow: Workflow = {
      id,
      userId: insertWorkflow.userId,
      title: insertWorkflow.title,
      createdAt: now,
      updatedAt: now,
      status: "pending",
      videoPath: insertWorkflow.videoPath,
      rawExtraction: null,
      organizedWorkflow: null,
      blockStructure: null
    };
    
    this.workflows.set(id, workflow);
    return workflow;
  }

  async updateWorkflowStatus(id: number, status: string): Promise<Workflow | undefined> {
    const workflow = this.workflows.get(id);
    
    if (!workflow) {
      return undefined;
    }
    
    const updatedWorkflow = {
      ...workflow,
      status,
      updatedAt: new Date()
    };
    
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  async updateWorkflowRawExtraction(id: number, rawExtraction: any): Promise<Workflow | undefined> {
    const workflow = this.workflows.get(id);
    
    if (!workflow) {
      return undefined;
    }
    
    const updatedWorkflow = {
      ...workflow,
      rawExtraction,
      updatedAt: new Date()
    };
    
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  async updateWorkflowOrganizedData(id: number, organizedWorkflow: any): Promise<Workflow | undefined> {
    const workflow = this.workflows.get(id);
    
    if (!workflow) {
      return undefined;
    }
    
    const updatedWorkflow = {
      ...workflow,
      organizedWorkflow,
      updatedAt: new Date()
    };
    
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  async updateWorkflowBlockStructure(id: number, blockStructure: BlockStructure): Promise<Workflow | undefined> {
    const workflow = this.workflows.get(id);
    
    if (!workflow) {
      return undefined;
    }
    
    const updatedWorkflow = {
      ...workflow,
      blockStructure,
      updatedAt: new Date()
    };
    
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }
}

export const storage = new MemStorage();
