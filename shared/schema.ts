import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  videoPath: text("video_path"),
  rawExtraction: json("raw_extraction"),
  organizedWorkflow: json("organized_workflow"), 
  blockStructure: json("block_structure")
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  userId: true,
  title: true,
  videoPath: true,
});

export const updateWorkflowSchema = createInsertSchema(workflows).pick({
  status: true,
  rawExtraction: true,
  organizedWorkflow: true,
  blockStructure: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof updateWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// Define the new action-focused enum
export enum BlockIntent {
  EDIT = "edit",         // Modifying existing content (docs, data, settings)
  VIEW = "view",         // Reading, reviewing, observing content without changes
  SEARCH = "search",       // Querying, finding information (web, database, files)
  GENERATE = "generate",   // Creating new content/data, often with assistance (e.g., LLM)
  INPUT = "input",        // Entering new data manually (forms, fields)
  EXTRACT = "extract",     // Pulling specific data out from a source
  TRANSFER = "transfer",   // Moving data between locations/applications (copy/paste, export/import)
  DECISION = "decision",   // Representing a conditional branch point in the workflow
  COMMUNICATE = "communicate", // Sending information (email, message)
  UNKNOWN = "unknown"      // Fallback for unclear intent
}

// Source Types
export enum SourceType {
  File = "file",
  Web = "web",
  API = "api",
  Manual = "manual"
}

// Update Rules
export enum UpdateRule {
  OnSourceChange = "onSourceChange",
  Manual = "manual",
  Scheduled = "scheduled",
  OnEvent = "onEvent"
}

export interface Block {
  id: string;
  intent: BlockIntent;
  title: string;
  description: string;
  properties: { 
    updateRules?: UpdateRule; 
    [key: string]: any; // Allow other properties if needed
  };
  applicationName?: string;
}

export type Source = {
  id: string;
  type: SourceType;
  location: string;
  updateRules: UpdateRule;
};

export type Connection = {
  sourceBlockId: string;
  targetBlockId: string;
  dataType: string;
  updateRules: UpdateRule;
};

export type BlockStructure = {
  blocks: Block[];
  sources: Source[];
  connections: Connection[];
};
