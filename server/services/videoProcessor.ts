import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { readdir as readDirectory, mkdir } from 'fs/promises';

// Since we're in a browser environment for this POC, we'll simulate video processing
// In a real implementation, this would use ffmpeg or similar to process the video files

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);

interface VideoMetadata {
  duration: number;
  format: string;
  hasAudio: boolean;
  resolution: {
    width: number;
    height: number;
  }
}

export class VideoProcessor {
  private uploadDir: string;
  
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDirectory();
  }
  
  private async ensureUploadDirectory() {
    try {
      if (!(await exists(this.uploadDir))) {
        await mkdir(this.uploadDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }
  
  async saveVideo(fileBuffer: Buffer, filename: string): Promise<string> {
    const videoPath = path.join(this.uploadDir, filename);
    await writeFile(videoPath, fileBuffer);
    return videoPath;
  }
  
  async validateVideo(filePath: string): Promise<{ isValid: boolean, message?: string }> {
    try {
      // In a real implementation, we would inspect the video file to validate its format, size, etc.
      // For this POC, we'll do a basic file existence check
      const fileExists = await exists(filePath);
      
      if (!fileExists) {
        return { isValid: false, message: 'Video file not found' };
      }
      
      // Check file extension
      const extension = path.extname(filePath).toLowerCase();
      if (extension !== '.mov') {
        return { isValid: false, message: 'Only QuickTime (.mov) files are supported' };
      }
      
      // Get file size
      const stats = await fs.promises.stat(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      if (fileSizeInMB > 300) {
        return { isValid: false, message: 'File size exceeds 300MB limit' };
      }
      
      // In a real implementation, we would also check the video duration
      // For now, we'll just return valid
      return { isValid: true };
    } catch (error) {
      console.error('Error validating video:', error);
      return { isValid: false, message: 'Error validating video file' };
    }
  }
  
  async preprocessVideo(filePath: string): Promise<string> {
    try {
      // Placeholder for potential future preprocessing like format conversion
      // For now, just return the original path.
      return filePath;
    } catch (error) {
      console.error('Error preprocessing video:', error);
      throw new Error('Failed to preprocess video');
    }
  }
  
  async extractFrames(
    filePath: string, 
    workflowId: number,
    framesPerSecond: number = 1
  ): Promise<{ framePaths: string[], tempDir: string }> {
    // --- IMPLEMENTATION USING FFMPEG ---
    console.log(`Starting frame extraction for: ${filePath}, workflowId: ${workflowId}`);
    
    // Create a unique temporary directory for this workflow's frames
    const tempDir = path.join(this.uploadDir, `temp_frames_${workflowId}`);
    await mkdir(tempDir, { recursive: true });
    console.log(`Created temporary frame directory: ${tempDir}`);

    const fileBasename = path.basename(filePath, path.extname(filePath));
    // Update output pattern to use the temporary directory
    const outputPattern = path.join(tempDir, `${fileBasename}_frame_%03d.jpg`);

    return new Promise(async (resolve, reject) => {
      const command = ffmpeg(filePath);
      // No longer need to store filenames here
      // let generatedFilenames: string[] = [];

      // Construct the regex pattern for matching frame files
      const framePattern = new RegExp(`${fileBasename}_frame_\\d{3}\\.jpg`);

      command
        // Log the exact command being run
        .on('start', (commandLine: string) => {
          console.log('Spawned Ffmpeg with command: ' + commandLine);
        })
        // Log any output from ffmpeg's stderr
        .on('stderr', (stderrLine: string) => {
          console.log('Ffmpeg stderr: ' + stderrLine);
        })
        // REMOVE the problematic 'filenames' handler
        /*
        .on('filenames', (filenames: string[]) => {
          console.log('Generated frame filenames:', filenames);
          // Store the filenames when the event occurs
          generatedFilenames = filenames;
        })
        */
        .on('end', async () => { // Make the handler async
          console.log('Frame extraction finished.');
          try {
            // Manually read the temporary directory contents
            const allFiles = await readDirectory(tempDir);
            
            // Filter for files matching our pattern
            const frameFiles = allFiles.filter(file => framePattern.test(file));

            if (frameFiles.length > 0) {
              console.log(`Found ${frameFiles.length} generated frame files.`);
              // Construct full paths within the temporary directory
              const fullPaths = frameFiles.map(name => path.join(tempDir, name));
              // Resolve with paths and the temp directory path
              resolve({ framePaths: fullPaths, tempDir: tempDir });
            } else {
              // If ffmpeg finished but we couldn't find matching files, reject.
              console.error('ffmpeg finished but no matching frame files were found in the directory.');
              reject(new Error('Frame extraction completed but no frames were found.'));
            }
          } catch (dirError) {
            console.error('Error reading output directory after ffmpeg finished:', dirError);
            // Attempt cleanup even if directory reading failed, but reject afterwards
            await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(cleanupErr => console.error('Error during cleanup after directory read failure:', cleanupErr));
            reject(new Error('Failed to read output directory after frame extraction.'));
          }
        })
        .on('error', async (err: Error) => { // Make error handler async
          console.error('Error during frame extraction:', err);
          // Attempt cleanup on error before rejecting
          await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(cleanupErr => console.error('Error during cleanup after ffmpeg error:', cleanupErr));
          // Reject the promise on error
          reject(new Error(`Failed to extract frames: ${err.message}`));
        })
        // Extract 'framesPerSecond' frames per second of video
        // -vf fps=... filter sets the rate
        // -qscale:v 2 sets the JPEG quality (2-5 is good)
        .outputOptions([
          `-vf fps=${framesPerSecond}`,
          '-qscale:v 2'
        ])
        .output(outputPattern) // Use the pattern for output filenames
        .run();
    });
    // --- END OF FFMPEG IMPLEMENTATION ---
  }
  
  async extractAudio(videoPath: string, workflowId: number): Promise<string> {
    console.log(`Starting audio extraction for: ${videoPath}, workflowId: ${workflowId}`);

    // Define the path for the temporary audio file
    const tempAudioDir = path.join(this.uploadDir, 'temp_audio');
    await mkdir(tempAudioDir, { recursive: true }); // Ensure directory exists
    const audioOutputPath = path.join(tempAudioDir, `audio_${workflowId}.wav`);

    console.log(`Attempting to extract audio to: ${audioOutputPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-vn',         // No video
          '-acodec pcm_s16le', // Standard WAV codec
          '-ar 44100',   // Standard sample rate
          '-ac 1'        // Mono channel
        ])
        .output(audioOutputPath)
        .on('start', (commandLine: string) => {
          console.log('Spawned Ffmpeg for audio extraction with command: ' + commandLine);
        })
        .on('stderr', (stderrLine: string) => {
          // Don't log every single stderr line, can be noisy
          // console.log('Ffmpeg (audio) stderr: ' + stderrLine);
        })
        .on('end', () => {
          console.log(`Audio extraction finished successfully: ${audioOutputPath}`);
          resolve(audioOutputPath);
        })
        .on('error', (err: Error) => {
          console.error('Error during audio extraction:', err);
          reject(new Error(`Failed to extract audio: ${err.message}`));
        })
        .run();
    });
  }
  
  async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Error getting video metadata:', err);
          return reject(new Error(`Failed to get video metadata: ${err.message}`));
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          return reject(new Error('No video stream found in the file.'));
        }

        const result: VideoMetadata = {
          duration: metadata.format.duration ?? 0,
          format: metadata.format.format_long_name ?? 'Unknown',
          hasAudio: !!audioStream, // Check if an audio stream exists
          resolution: {
            width: videoStream.width ?? 0,
            height: videoStream.height ?? 0,
          }
        };

        resolve(result);
      });
    });
  }
}

export const videoProcessor = new VideoProcessor();
