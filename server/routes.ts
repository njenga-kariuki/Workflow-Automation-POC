import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { videoProcessor } from "./services/videoProcessor";
import { workflowService } from "./services/workflow";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  }),
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".mov") {
      return cb(new Error("Only .mov files are allowed"));
    }
    cb(null, true);
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  // Upload video endpoint
  app.post(
    "/api/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Get file path from multer
        const videoPath = req.file.path;

        // Validate video
        const validationResult = await videoProcessor.validateVideo(videoPath);
        if (!validationResult.isValid) {
          // Remove invalid file
          fs.unlinkSync(videoPath);
          return res
            .status(400)
            .json({ message: validationResult.message || "Invalid video file" });
        }

        // Create new workflow record
        const workflow = await storage.createWorkflow({
          userId: 1, // Default user for POC
          title: req.body.title || "Untitled Workflow",
          videoPath: videoPath,
        });

        res.status(201).json({
          message: "Video uploaded successfully",
          workflowId: workflow.id,
        });
      } catch (error) {
        console.error("Error uploading video:", error);
        res.status(500).json({ message: "Error uploading video" });
      }
    }
  );

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

      const status = await workflowService.getWorkflowStatus(workflowId);
      res.json(status);
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
