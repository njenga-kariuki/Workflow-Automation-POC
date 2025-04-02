import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

export interface FileChunk {
  index: number;
  totalChunks: number;
  data: Buffer;
  filename: string;
  originalFilename: string;
  title: string;
  userId: number;
}

export class ChunkUploadService {
  private chunksDir: string;
  private uploadsDir: string;
  private chunkMap: Map<string, Set<number>>;

  constructor() {
    this.chunksDir = path.join(process.cwd(), 'uploads', 'chunks');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.chunkMap = new Map<string, Set<number>>();
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.chunksDir)) {
      fs.mkdirSync(this.chunksDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private getChunkKey(filename: string): string {
    return filename;
  }

  private getChunkPath(key: string, index: number): string {
    return path.join(this.chunksDir, `${key}.part${index}`);
  }

  private getOutputPath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  async saveChunk(chunk: FileChunk): Promise<{
    complete: boolean;
    missingChunks: number[];
    workflowId?: number;
  }> {
    const key = this.getChunkKey(chunk.filename);
    const chunkPath = this.getChunkPath(key, chunk.index);
    
    // Save this chunk
    await fs.promises.writeFile(chunkPath, chunk.data);
    
    // Track this chunk
    if (!this.chunkMap.has(key)) {
      this.chunkMap.set(key, new Set<number>());
    }
    this.chunkMap.get(key)!.add(chunk.index);
    
    // Check if all chunks are uploaded
    const uploadedChunks = this.chunkMap.get(key)!;
    const complete = uploadedChunks.size === chunk.totalChunks;
    
    // If complete, assemble the file
    let workflowId: number | undefined;
    if (complete) {
      const outputPath = this.getOutputPath(chunk.filename);
      await this.assembleFile(key, chunk.totalChunks, outputPath);
      
      // Clean up chunks
      await this.cleanupChunks(key, chunk.totalChunks);
      
      // Create workflow record
      const workflow = await storage.createWorkflow({
        userId: chunk.userId, 
        title: chunk.title || chunk.originalFilename || "Untitled Workflow",
        videoPath: outputPath,
      });
      
      workflowId = workflow.id;
      
      // Remove from tracking
      this.chunkMap.delete(key);
    }
    
    // Return missing chunks
    const missingChunks: number[] = [];
    if (!complete) {
      for (let i = 0; i < chunk.totalChunks; i++) {
        if (!uploadedChunks.has(i)) {
          missingChunks.push(i);
        }
      }
    }
    
    return { 
      complete, 
      missingChunks,
      workflowId
    };
  }

  private async assembleFile(key: string, totalChunks: number, outputPath: string): Promise<void> {
    // Create or clear the output file
    const outputStream = fs.createWriteStream(outputPath);
    
    try {
      // For each chunk in order
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = this.getChunkPath(key, i);
        // Read the chunk and append to output file
        const chunkData = await fs.promises.readFile(chunkPath);
        await new Promise<void>((resolve, reject) => {
          outputStream.write(chunkData, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } finally {
      // Close the output file
      outputStream.end();
    }
  }

  private async cleanupChunks(key: string, totalChunks: number): Promise<void> {
    // Delete all chunk files
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = this.getChunkPath(key, i);
      if (fs.existsSync(chunkPath)) {
        await fs.promises.unlink(chunkPath);
      }
    }
  }
}

export const chunkUploadService = new ChunkUploadService();