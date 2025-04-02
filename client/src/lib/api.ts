import { apiRequest } from "./queryClient";
import { Block, BlockStructure } from "@shared/schema";

export interface WorkflowStatus {
  status: string;
  progress: {
    videoProcessing: number;
    rawExtraction: number;
    organization: number;
    blockGeneration: number;
    overall: number;
  };
  estimatedTimeRemaining?: number;
}

export interface WorkflowData {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  videoPath: string | null;
  rawExtraction: any;
  organizedWorkflow: any;
  blockStructure: BlockStructure | null;
}

// API functions for workflows
export const workflowApi = {
  // Upload a video file
  uploadVideo: async (file: File, title: string): Promise<{ workflowId: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }
    
    return await response.json();
  },
  
  // Start workflow processing
  processWorkflow: async (workflowId: number): Promise<void> => {
    await apiRequest('POST', `/api/workflow/${workflowId}/process`, {});
  },
  
  // Get workflow status
  getWorkflowStatus: async (workflowId: number): Promise<WorkflowStatus> => {
    const response = await fetch(`/api/workflow/${workflowId}/status`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching workflow status: ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  // Get workflow data
  getWorkflow: async (workflowId: number): Promise<WorkflowData> => {
    const response = await fetch(`/api/workflow/${workflowId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching workflow: ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  // Update workflow block structure
  updateWorkflowBlocks: async (workflowId: number, blockStructure: BlockStructure): Promise<WorkflowData> => {
    const response = await apiRequest('PUT', `/api/workflow/${workflowId}/blocks`, blockStructure);
    return await response.json();
  },
  
  // Get all workflows
  getWorkflows: async (): Promise<WorkflowData[]> => {
    const response = await fetch('/api/workflows', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching workflows: ${response.statusText}`);
    }
    
    return await response.json();
  }
};
