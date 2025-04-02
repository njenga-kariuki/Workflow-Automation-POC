import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import fs from "fs";
import { videoProcessor } from "./services/videoProcessor";
import { workflowService } from "./services/workflow";
import { z } from "zod";
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { chunkUploadService } from './services/chunkUploadService';

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  // Chunk upload endpoint
  app.post("/api/upload/chunk", async (req: Request, res: Response) => {
    try {
      // Create a buffer parser for multipart/form-data
      const busboy = require('busboy')({ headers: req.headers });
      let fileData: Buffer | null = null;
      let index = -1;
      let totalChunks = -1;
      let filename = '';
      let originalFilename = '';
      let title = '';
      
      // Handle file parts
      busboy.on('file', (_fieldname: string, file: any, info: any) => {
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        file.on('end', () => {
          fileData = Buffer.concat(chunks);
          originalFilename = info.filename;
        });
      });
      
      // Handle form fields
      busboy.on('field', (fieldname: string, val: string) => {
        if (fieldname === 'index') index = parseInt(val, 10);
        else if (fieldname === 'totalChunks') totalChunks = parseInt(val, 10);
        else if (fieldname === 'filename') filename = val;
        else if (fieldname === 'title') title = val;
      });
      
      // Handle parsing complete
      busboy.on('finish', async () => {
        // Validate inputs
        if (index === -1 || totalChunks === -1 || !filename || !fileData) {
          return res.status(400).json({ 
            message: 'Missing required parameters for chunk upload'
          });
        }
        
        // Process the chunk
        const result = await chunkUploadService.saveChunk({
          index,
          totalChunks,
          data: fileData,
          filename,
          originalFilename,
          title: title || originalFilename || 'Untitled',
          userId: 1, // Default user ID
        });
        
        res.json(result);
      });
      
      // Pipe the request to busboy
      req.pipe(busboy);
    } catch (error) {
      console.error('Error processing chunk upload:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Unknown error during chunk upload' 
      });
    }
  });

  // Upload video endpoint
  app.post(
    "/api/upload/initiate",
    async (req: Request, res: Response) => {
      try {
        // 1. Validate request body
        const { filename, contentType, title } = req.body;
        if (!filename || !contentType) {
          return res.status(400).json({ message: "Missing filename or contentType in request body" });
        }
        
        // Optional: Add more robust validation (e.g., allowed content types)
        if (!contentType.startsWith('video/')) {
             console.warn(`Received non-video contentType: ${contentType}. Allowing for now.`);
        }

        // 2. Get GCS configuration from environment variables
        const gcsBucketName = process.env.GCS_BUCKET_NAME;
        const credentialsJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

        if (!gcsBucketName) {
          console.error("GCS_BUCKET_NAME environment variable not set.");
          return res.status(500).json({ message: "Server configuration error: Missing GCS bucket name." });
        }
        if (!credentialsJsonString) {
           console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set.");
           return res.status(500).json({ message: "Server configuration error: Missing GCS credentials." });
        }

        let googleCredentials: Record<string, any> | undefined = undefined;
        try {
            googleCredentials = JSON.parse(credentialsJsonString);
        } catch (e) {
            console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON.", e);
            return res.status(500).json({ message: "Server configuration error: Invalid GCS credentials format." });
        }

        // 3. Instantiate GCS client
        const storageClient = new Storage({ credentials: googleCredentials });

        // 4. Define GCS object details
        const uniqueSuffix = uuidv4();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_'); // Basic sanitization
        const gcsObjectName = `uploads/${uniqueSuffix}-${sanitizedFilename}`; // Store in an 'uploads' virtual folder
        const gcsPath = `gs://${gcsBucketName}/${gcsObjectName}`;
        
        // 5. Define Presigned URL options
        const options = {
          version: 'v4' as const,
          action: 'resumable' as const, // Changed from 'write' to 'resumable'
          expires: Date.now() + 15 * 60 * 1000, // 15 minutes
          // contentType is not needed for resumable initiation URL
          // It will be specified by the client in the POST to the resumable URL
        };

        // 6. Generate the Presigned URL for initiating the resumable upload
        console.log(`Generating V4 presigned URL for RESUMABLE upload: ${gcsPath}`);
        const [initiateResumableUrl] = await storageClient
          .bucket(gcsBucketName)
          .file(gcsObjectName)
          .getSignedUrl(options);
          
        console.log(`Successfully generated V4 presigned URL for RESUMABLE initiation.`);

        // 7. Return URL and GCS Path to client
        // Client will POST to 'initiateResumableUrl' to get the session URI,
        // then PUT the file to the session URI.
        res.status(200).json({
          // Rename field for clarity
          initiateResumableUploadUrl: initiateResumableUrl, 
          gcsPath: gcsPath,
        });

      } catch (error) {
        console.error("Error generating presigned URL:", error);
        res.status(500).json({ message: "Error initiating file upload" });
      }
    }
  );

  // === NEW Endpoint: Create Workflow Record After GCS Upload ===
  app.post("/api/workflow/create", async (req: Request, res: Response) => {
    try {
      // 1. Validate request body
      // Assuming userId comes from authentication middleware in a real app
      // For now, defaulting to 1 or expecting it in the body
      const { gcsPath, title, userId = 1 } = req.body; 
      
      if (!gcsPath || !title) {
        return res.status(400).json({ message: "Missing gcsPath or title in request body" });
      }

      // Basic validation of gcsPath format
      if (!gcsPath.startsWith('gs://')) {
         return res.status(400).json({ message: "Invalid gcsPath format. Must start with gs://" });
      }

      // 2. Create workflow record using the GCS path
      const workflow = await storage.createWorkflow({
        userId: Number(userId),
        title: title,
        videoPath: gcsPath, // Store the GCS path
        // status: 'uploaded', // Removed: Status is set internally by createWorkflow
      });

      console.log(`Created workflow ${workflow.id} (status: ${workflow.status}) for GCS path: ${gcsPath}`);

      // 3. Optionally, trigger processing immediately or let client decide
      // workflowService.processWorkflow(workflow.id).catch(err => { ... });

      // 4. Return the created workflow details
      res.status(201).json(workflow);

    } catch (error) {
      console.error("Error creating workflow:", error);
      // More specific error handling might be needed based on storage errors
      res.status(500).json({ message: "Error creating workflow record" });
    }
  });

  // === End of NEW Endpoint ===

  // Start workflow processing
  app.post("/api/workflow/:id/process", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      
      // Check if workflow exists
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Process workflow asynchronously
      workflowService.processWorkflow(workflowId).catch((error) => {
        console.error(`Error processing workflow ${workflowId}:`, error);
      });

      res.json({ message: "Workflow processing started" });
    } catch (error) {
      console.error("Error starting workflow processing:", error);
      res.status(500).json({ message: "Error starting workflow processing" });
    }
  });

  // Get workflow status
  app.get("/api/workflow/:id/status", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      
      // Check if workflow exists
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      res.json(workflow);
    } catch (error) {
      console.error("Error getting workflow status:", error);
      res.status(500).json({ message: "Error getting workflow status" });
    }
  });

  // Get workflow data
  app.get("/api/workflow/:id", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      
      // Check if workflow exists
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      res.json(workflow);
    } catch (error) {
      console.error("Error getting workflow:", error);
      res.status(500).json({ message: "Error getting workflow" });
    }
  });

  // Get all workflows
  app.get("/api/workflows", async (req, res) => {
    try {
      const workflows = await storage.listWorkflows();
      res.json(workflows);
    } catch (error) {
      console.error("Error getting workflows:", error);
      res.status(500).json({ message: "Error getting workflows" });
    }
  });

  // Update workflow block structure
  app.put("/api/workflow/:id/blocks", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      
      // Check if workflow exists
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Validate block structure data
      if (!req.body || !req.body.blocks || !req.body.connections) {
        return res.status(400).json({ message: "Invalid block structure data" });
      }

      // Update block structure
      const updatedWorkflow = await storage.updateWorkflowBlockStructure(
        workflowId,
        req.body
      );

      res.json(updatedWorkflow);
    } catch (error) {
      console.error("Error updating workflow blocks:", error);
      res.status(500).json({ message: "Error updating workflow blocks" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
