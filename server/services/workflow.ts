import { BlockStructure } from '@shared/schema';
import { storage } from '../storage';
import { videoProcessor } from './videoProcessor';
import { aiService } from './aiService';

export class WorkflowService {
  async processWorkflow(workflowId: number): Promise<boolean> {
    try {
      // Get workflow data
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow || !workflow.videoPath) {
        console.error(`Workflow not found or invalid: ${workflowId}`);
        return false;
      }
      
      // Update status to processing
      await storage.updateWorkflowStatus(workflowId, 'processing');
      
      // Step 1: Video processing
      console.log(`Starting video processing for workflow ${workflowId}`);
      const validationResult = await videoProcessor.validateVideo(workflow.videoPath);
      
      if (!validationResult.isValid) {
        await storage.updateWorkflowStatus(workflowId, 'failed');
        console.error(`Video validation failed: ${validationResult.message}`);
        return false;
      }
      
      const processedVideoPath = await videoProcessor.preprocessVideo(workflow.videoPath);
      const framePaths = await videoProcessor.extractFrames(processedVideoPath);
      
      // Step 2: Raw workflow extraction using Gemini
      console.log(`Starting raw extraction for workflow ${workflowId}`);
      const rawExtraction = await aiService.extractRawWorkflow(processedVideoPath, framePaths);
      await storage.updateWorkflowRawExtraction(workflowId, rawExtraction);
      
      // Step 3: Workflow organization using Claude
      console.log(`Starting workflow organization for workflow ${workflowId}`);
      const organizedWorkflow = await aiService.organizeWorkflow(rawExtraction);
      await storage.updateWorkflowOrganizedData(workflowId, organizedWorkflow);
      
      // Step 4: Block structure generation using Claude
      console.log(`Starting block structure generation for workflow ${workflowId}`);
      const blockStructure = await aiService.generateBlockStructure(organizedWorkflow);
      await storage.updateWorkflowBlockStructure(workflowId, blockStructure);
      
      // Update status to completed
      await storage.updateWorkflowStatus(workflowId, 'completed');
      
      return true;
    } catch (error) {
      console.error(`Error processing workflow ${workflowId}:`, error);
      await storage.updateWorkflowStatus(workflowId, 'failed');
      return false;
    }
  }
  
  async getWorkflowStatus(workflowId: number): Promise<{
    status: string;
    progress: {
      videoProcessing: number;
      rawExtraction: number;
      organization: number;
      blockGeneration: number;
      overall: number;
    };
    estimatedTimeRemaining?: number;
  }> {
    const workflow = await storage.getWorkflow(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    let videoProcessing = 0;
    let rawExtraction = 0;
    let organization = 0;
    let blockGeneration = 0;
    
    // Calculate progress based on workflow state
    if (workflow.status === 'completed') {
      videoProcessing = 100;
      rawExtraction = 100;
      organization = 100;
      blockGeneration = 100;
    } else if (workflow.status === 'failed') {
      // Determine which step failed based on data availability
      if (workflow.blockStructure) {
        videoProcessing = 100;
        rawExtraction = 100;
        organization = 100;
        blockGeneration = 50; // Failed during block generation
      } else if (workflow.organizedWorkflow) {
        videoProcessing = 100;
        rawExtraction = 100;
        organization = 100;
        blockGeneration = 0;
      } else if (workflow.rawExtraction) {
        videoProcessing = 100;
        rawExtraction = 100;
        organization = 0;
        blockGeneration = 0;
      } else {
        videoProcessing = 50; // Failed during video processing
        rawExtraction = 0;
        organization = 0;
        blockGeneration = 0;
      }
    } else if (workflow.status === 'processing') {
      // Determine progress based on what data is available
      videoProcessing = 100; // Video processing is always first
      
      if (workflow.rawExtraction) {
        rawExtraction = 100;
        if (workflow.organizedWorkflow) {
          organization = 100;
          blockGeneration = workflow.blockStructure ? 100 : 50;
        } else {
          organization = 50;
          blockGeneration = 0;
        }
      } else {
        rawExtraction = 50;
        organization = 0;
        blockGeneration = 0;
      }
    }
    
    // Calculate overall progress (weighted)
    const overall = Math.round(
      (videoProcessing * 0.1) + 
      (rawExtraction * 0.3) + 
      (organization * 0.3) + 
      (blockGeneration * 0.3)
    );
    
    // Estimate time remaining (in seconds)
    // This is a very rough estimate for the POC
    let estimatedTimeRemaining;
    
    if (workflow.status === 'processing' && overall < 100) {
      // Assume each percentage point takes about 1 second
      estimatedTimeRemaining = (100 - overall) * 1;
    }
    
    return {
      status: workflow.status,
      progress: {
        videoProcessing,
        rawExtraction,
        organization,
        blockGeneration,
        overall
      },
      estimatedTimeRemaining
    };
  }
}

export const workflowService = new WorkflowService();
