import { BlockStructure } from '@shared/schema';
import { storage } from '../storage';
import { videoProcessor } from './videoProcessor';
import { aiService } from './aiService';
import fs from 'fs'; // Import fs for cleanup
import path from 'path'; // Import path
import { Storage } from '@google-cloud/storage'; // Added
import os from 'os'; // Added for temp directory
import { v4 as uuidv4 } from 'uuid'; // Added for unique temp filenames

export class WorkflowService {
  private storageClient: Storage | null = null; // Added GCS client instance

  constructor() {
    // Initialize GCS client if credentials are available
    const credentialsJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJsonString) {
      try {
        const googleCredentials = JSON.parse(credentialsJsonString);
        this.storageClient = new Storage({ credentials: googleCredentials });
        console.log("WorkflowService: GCS Storage client initialized.");
      } catch (e) {
        console.error("WorkflowService: Failed to parse GCS credentials. GCS operations will fail.", e);
      }
    } else {
       console.warn("WorkflowService: GOOGLE_APPLICATION_CREDENTIALS_JSON not set. Cannot download GCS files.");
    }
  }
  
  async processWorkflow(workflowId: number): Promise<boolean> {
    let tempFrameDir: string | null = null; // Variable to hold temp dir path
    let tempAudioPath: string | null = null; // Variable to hold temp audio path
    let localVideoPath: string | null = null; // Path to the video file on local disk (original or downloaded)
    let shouldCleanupLocalVideo = false; // Flag to indicate if localVideoPath needs cleanup
    
    try {
      // Get workflow data
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow || !workflow.videoPath) {
        console.error(`Workflow not found or invalid video path: ${workflowId}`);
        return false;
      }
      
      // Update status to processing
      await storage.updateWorkflowStatus(workflowId, 'processing');
      
      // --- Determine Video Path (Local or GCS) ---
      if (workflow.videoPath.startsWith('gs://')) {
        if (!this.storageClient) {
          throw new Error("GCS Storage client not initialized. Cannot process GCS path.");
        }
        console.log(`Processing GCS video path: ${workflow.videoPath}`);
        const gcsPath = workflow.videoPath;
        const bucketName = gcsPath.split('/')[2];
        const objectName = gcsPath.split('/').slice(3).join('/');
        
        // Create a temporary local path for download
        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'workflow-video-'));
        localVideoPath = path.join(tempDir, `${uuidv4()}-${path.basename(objectName)}`);
        shouldCleanupLocalVideo = true; // Mark for cleanup

        console.log(`Downloading ${gcsPath} to temporary path ${localVideoPath}...`);
        await this.storageClient.bucket(bucketName).file(objectName).download({ destination: localVideoPath });
        console.log(`Successfully downloaded GCS video to ${localVideoPath}.`);
        
      } else {
        // Assume it's already a local path
        console.log(`Processing local video path: ${workflow.videoPath}`);
        localVideoPath = workflow.videoPath;
        // Do NOT clean up if it was originally a local path provided by the user/system
        shouldCleanupLocalVideo = false; 
      }
      // --- End Video Path Determination ---
      
      // Ensure we have a local path to work with
      if (!localVideoPath) {
         throw new Error("Could not determine local video path for processing.");
      }
      
      // Step 1: Video processing
      console.log(`Starting video processing for workflow ${workflowId} using ${localVideoPath}`);
      const validationResult = await videoProcessor.validateVideo(localVideoPath);
      
      if (!validationResult.isValid) {
        await storage.updateWorkflowStatus(workflowId, 'failed');
        console.error(`Video validation failed: ${validationResult.message}`);
        return false;
      }
      
      const processedVideoPath = await videoProcessor.preprocessVideo(localVideoPath);
      
      // --- Extract Frames and Audio Concurrently ---
      console.log(`Starting frame and audio extraction for workflow ${workflowId} from ${processedVideoPath}`);
      let framePaths: string[] = [];
      let audioTranscript: string = '';

      const extractionPromises = [];

      // Promise for frame extraction
      extractionPromises.push(
          videoProcessor.extractFrames(processedVideoPath, workflowId).then(result => {
              tempFrameDir = result.tempDir; // Store tempDir path for cleanup
              framePaths = result.framePaths;
              console.log(`Frame extraction completed for workflow ${workflowId}`);
          }).catch(err => {
              console.error(`Frame extraction failed for workflow ${workflowId}:`, err);
              throw err; // Propagate error
          })
      );

      // Promise for audio extraction and transcription
      extractionPromises.push(
          videoProcessor.extractAudio(processedVideoPath, workflowId).then(async (audioPath) => {
              tempAudioPath = audioPath; // Store temp audio path for cleanup
              console.log(`Audio extraction completed for workflow ${workflowId}, starting transcription.`);
              return aiService.transcribeAudio(audioPath);
          }).then(transcript => {
              audioTranscript = transcript;
              console.log(`Audio transcription completed for workflow ${workflowId}. Transcript length: ${transcript.length}`);
              // Attempt cleanup of audio file immediately after transcription
              if (tempAudioPath) {
                  fs.promises.rm(tempAudioPath, { force: true }).catch(cleanupErr => 
                      console.error(`Error removing temporary audio file ${tempAudioPath} immediately:`, cleanupErr)
                  );
                  // Don't nullify tempAudioPath here, keep it for the final finally block just in case
              }
          }).catch(err => {
              console.error(`Audio processing (extraction/transcription) failed for workflow ${workflowId}:`, err);
              // Decide if you want to throw or continue without audio
              // For now, let's allow continuing without audio transcript
              console.warn('Proceeding with workflow processing without audio transcript due to error.');
              audioTranscript = ''; // Ensure it's an empty string if failed
          })
      );
      
      // Wait for both frame and audio processing to complete
      await Promise.all(extractionPromises);
      console.log(`Frame and audio processing finished for workflow ${workflowId}`);
      // --- End of Concurrent Extraction ---

      // Step 2: Raw workflow extraction using Gemini and Claude
      console.log(`Starting raw extraction for workflow ${workflowId}`);
      // Pass the audioTranscript (which might be empty if transcription failed)
      const rawExtraction = await aiService.extractRawWorkflow(processedVideoPath, framePaths, audioTranscript);
      await storage.updateWorkflowRawExtraction(workflowId, rawExtraction);
      
      // Step 3: Workflow organization using Claude 3.7 Sonnet
      console.log(`Starting workflow organization for workflow ${workflowId}`);
      const organizedWorkflow = await aiService.organizeWorkflow(rawExtraction);
      await storage.updateWorkflowOrganizedData(workflowId, organizedWorkflow);
      
      // Step 4: Block structure generation using Claude 3.7 Sonnet
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
    } finally {
      // Cleanup: Always attempt to remove the temporary directories/files
      const cleanupPromises = [];
      if (shouldCleanupLocalVideo && localVideoPath) {
          console.log(`Attempting final cleanup of downloaded temporary video: ${localVideoPath}`);
          // Delete the containing directory created by mkdtemp
          const containingDir = path.dirname(localVideoPath);
          cleanupPromises.push(
            fs.promises.rm(containingDir, { recursive: true, force: true })
                .then(() => console.log(`Successfully removed temporary video directory: ${containingDir}`))
                .catch(cleanupError => console.error(`Error removing temporary video directory ${containingDir}:`, cleanupError))
          );
      }
      if (tempFrameDir) {
        console.log(`Attempting final cleanup of temporary frame directory: ${tempFrameDir}`);
        cleanupPromises.push(
          fs.promises.rm(tempFrameDir, { recursive: true, force: true })
            .then(() => console.log(`Successfully removed temporary frame directory: ${tempFrameDir}`))
            .catch(cleanupError => console.error(`Error removing temporary frame directory ${tempFrameDir}:`, cleanupError))
        );
      }
      // Also attempt cleanup for audio file in finally block, in case immediate cleanup failed
      if (tempAudioPath) {
         console.log(`Attempting final cleanup of temporary audio file: ${tempAudioPath}`);
         cleanupPromises.push(
           fs.promises.rm(tempAudioPath, { force: true })
             .then(() => console.log(`Successfully removed temporary audio file: ${tempAudioPath}`))
             .catch(cleanupError => {
                 // Check if it's a 'file not found' error (ENOENT), which is okay if immediate cleanup worked
                 if (cleanupError.code !== 'ENOENT') {
                     console.error(`Error removing temporary audio file ${tempAudioPath} in final cleanup:`, cleanupError);
                 }
             })
         );
      }
      await Promise.all(cleanupPromises);
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
