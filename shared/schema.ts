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

// Block Types
export enum BlockType {
  Document = "document",
  Presentation = "presentation",
  Interface = "interface",
  Data = "data"
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

// Block Structure Types
export type Block = {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  properties: Record<string, unknown>;
};

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
