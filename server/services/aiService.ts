import { BlockStructure, BlockType, SourceType, UpdateRule } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface RawWorkflowExtraction {
  transcript: {
    time: number;
    screen: string;
    action: string;
    narration: string;
  }[];
}

interface OrganizedWorkflow {
  steps: {
    number: number;
    action: string;
    applications: string[];
    input: {
      data: string;
      source: string;
    };
    output: {
      data: string;
      destination: string;
    };
    considerations: string[];
  }[];
  patterns: string[];
  conditionalLogic: string[];
  triggers: string[];
  frequency: string;
}

export class AIService {
  private anthropicClient: Anthropic;
  private geminiClient: GoogleGenerativeAI;
  private speechClient: SpeechClient;
  private anthropicAPIKey: string;
  private geminiAPIKey: string;
  
  constructor() {
    this.anthropicAPIKey = process.env.ANTHROPIC_API_KEY || '';
    this.geminiAPIKey = process.env.GOOGLE_AI_API_KEY || '';
    
    this.anthropicClient = new Anthropic({
      apiKey: this.anthropicAPIKey,
    });
    
    this.geminiClient = new GoogleGenerativeAI(this.geminiAPIKey);
    this.speechClient = new SpeechClient();
  }
  
  validateAPIKeys(): boolean {
    return Boolean(this.anthropicAPIKey) && Boolean(this.geminiAPIKey);
  }
  
  // Helper method to safely extract text from the Anthropic response
  private extractTextFromResponse(content: any): string {
    try {
      // If we have a content array with text type objects
      if (Array.isArray(content) && content.length > 0) {
        const firstContent = content[0];
        
        // Handle different response formats
        if (typeof firstContent === 'object') {
          if (firstContent.type === 'text' && typeof firstContent.text === 'string') {
            return firstContent.text;
          } else if (typeof firstContent.text === 'string') {
            return firstContent.text;
          }
        }
      }
      
      // JSON stringify as a last resort
      return typeof content === 'string' ? content : JSON.stringify(content);
    } catch (error) {
      console.error('Error extracting text from response:', error);
      return 'Failed to extract text from response';
    }
  }
  
  // Helper to parse JSON response, potentially cleaning up markdown code blocks
  private _parseJsonResponse<T>(responseText: string, methodName: string): T {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                      responseText.match(/```\n([\s\S]*?)\n```/) ||
                      [null, responseText]; // Assume raw text might be JSON if no markdown found

    const extractedJson = jsonMatch[1].trim();

    try {
      return JSON.parse(extractedJson) as T;
    } catch (jsonError) {
      console.error(`Failed to parse JSON from ${methodName} response:`, jsonError);
      console.log("Raw response text:", responseText); 
      // Throw a new error with context
      throw new Error(`Failed to parse JSON response in ${methodName}.`); 
    }
  }
  
  async transcribeAudio(audioPath: string): Promise<string> {
    console.log(`Starting transcription for audio file: ${audioPath}`);
    try {
      // Reads a local audio file and converts it to base64
      const file = await fs.promises.readFile(audioPath);
      const audioBytes = file.toString('base64');

      // The audio file's encoding, sample rate in hertz, and BCP-47 language code
      const audio = {
        content: audioBytes,
      };
      const config = {
        // encoding: 'LINEAR16', // Required for WAV
        // sampleRateHertz: 44100, // Match the extraction rate
        // Instead of encoding and sampleRateHertz, use auto-detection for simplicity if possible
        // or ensure the format from ffmpeg matches required params
        // Let's rely on auto-detection if the API supports it well for WAV
        // If issues arise, explicitly set encoding and sampleRateHertz
        languageCode: 'en-US', // Assuming English for now
        model: 'latest_long', // Use the specified model for long audio
        // Enable automatic punctuation - useful for narration
        enableAutomaticPunctuation: true, 
      };
      const request = {
        audio: audio,
        config: config,
      };

      // Detects speech in the audio file
      console.log('Sending request to Google Cloud Speech-to-Text...');
      const [operation] = await this.speechClient.longRunningRecognize(request);
      
      console.log('Waiting for transcription operation to complete...');
      const [response] = await operation.promise();
      console.log('Transcription operation completed.');

      if (!response.results || response.results.length === 0) {
        console.warn(`Transcription result empty for ${audioPath}`);
        return ''; // Return empty string if no transcription results
      }
      
      const transcription = response.results
        .map(result => result.alternatives![0].transcript)
        .join('\n');
        
      console.log(`Transcription successful for ${audioPath}. Length: ${transcription.length}`);
      return transcription;
    } catch (error) {
      console.error(`Failed to transcribe audio file ${audioPath}:`, error);
      // Don't throw, return empty string to allow workflow to potentially continue
      // Consider adding specific error handling or status updates if needed
      return ''; 
    }
  }
  
  async extractRawWorkflow(
    videoPath: string, 
    framePaths: string[], 
    audioTranscript?: string
  ): Promise<RawWorkflowExtraction> {
    console.log(`Extracting raw workflow from video: ${videoPath} with ${framePaths.length} frames using Gemini`);
    
    // Select a subset of frames for demonstration purposes
    const sampleFrames = framePaths.length > 3 ? 
      [framePaths[0], framePaths[Math.floor(framePaths.length / 2)], framePaths[framePaths.length - 1]] : 
      framePaths;
    
    // Process sample frames with Gemini 2.0 Flash
    const frameDescriptions = await Promise.all(sampleFrames.map(async (framePath, index) => {
      try {
        // Convert image to base64
        const imageBuffer = fs.readFileSync(framePath);
        
        // Get the Gemini model
        const geminiVisionModel = this.geminiClient.getGenerativeModel({ 
          model: "gemini-2.0-flash",
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            }
          ]
        });
        
        // Create a file part
        const filePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        };
        
        // Call Gemini API to describe the image
        const result = await geminiVisionModel.generateContent([
          "Describe what's happening in this screen capture from a workflow recording. Focus on what application is being used, what data is visible, and what actions seem to be taking place.",
          filePart
        ]);
        
        const response = result.response;
        const description = response.text();
        
        return {
          frameIndex: index,
          description: description
        };
      } catch (error) {
        console.error(`Error processing frame ${framePath} with Gemini:`, error);
        return {
          frameIndex: index,
          description: `Error processing frame ${index}`
        };
      }
    }));
    
    // Use Claude to generate a structured transcript based on frame descriptions
    // and audio transcript if available
    const transcriptPrompt = `
    I need to create a structured chronological transcript of a workflow video, synthesizing information from visual frames and user audio narration. The output must be in the following JSON format:
    {
      "transcript": [
        {
          "time": number (estimated timestamp or frame index),
          "screen": string (description of the main application/window visible),
          "action": string (specific user action performed),
          "narration": string (synthesized narration combining visual action and spoken explanation)
        }
        // ... more steps
      ]
    }

    Here are descriptions of key frames from the video:
    ${frameDescriptions.map(fd => `Frame ${fd.frameIndex}: ${fd.description}`).join('\n\n')}

    ${audioTranscript ? `And here is the complete audio transcript from the video:\n\"\"\"\n${audioTranscript}\n\"\"\"` : 'No audio transcript was provided.'}

    Follow these instructions carefully:
    1. Analyze the frame descriptions to identify the sequence of distinct user actions and the state of the screen at each step.
    2. For each identified step, determine the primary \`action\` performed and the \`screen\` context. Assign an approximate \`time\` or frame index.
    3. Generate the \`narration\` for each step by doing the following:
        a. Start with a brief, objective description of the core visual \`action\` identified from the frames (e.g., "User clicked 'Save button'.").
        b. ${audioTranscript ? 'Consult the provided audio transcript. Find the segment of the transcript that corresponds to this visual action based on timing and context.' : ''}
        c. ${audioTranscript ? 'Append relevant explanations, context, goals, or details spoken by the user during that segment. Focus on adding the user\'s *why* or extra information that complements the visual *what*. Do not just repeat the action description.' : ''}
        d. ${audioTranscript ? 'If the audio transcript is silent or clearly irrelevant during the time of this visual action, the narration should primarily consist of the objective description from step 3a.' : 'Since no audio transcript was provided, the narration should consist of the objective description of the visual action.'}
    4. Ensure the final output is a valid JSON object matching the specified structure, containing a \`transcript\` array of step objects. Maintain chronological order and keep steps granular.
    `;
    
    try {
      const response = await this.anthropicClient.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: transcriptPrompt
          }
        ]
      });
      
      // Extract text from response
      const responseText = this.extractTextFromResponse(response.content);
      
      // Parse the response using the helper method
      const parsedResult = this._parseJsonResponse<RawWorkflowExtraction>(responseText, 'extractRawWorkflow');
      
      // LOGGING ADDED HERE
      console.log("--- Raw Workflow Extraction Output ---");
      console.log(JSON.stringify(parsedResult, null, 2));
      console.log("-------------------------------------");
      return parsedResult;
    } catch (error) {
      // Catch API errors or parsing errors from the helper
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error calling Claude for transcript generation:", message);
      throw new Error(`AI service failed during transcript generation: ${message}`);
    }
  }
  
  async organizeWorkflow(rawExtraction: RawWorkflowExtraction): Promise<OrganizedWorkflow> {
    console.log(`Organizing workflow from raw extraction with ${rawExtraction.transcript.length} steps`);
    
    const organizePrompt = `
    I need to organize and structure a workflow based on a transcript. 
    
    Here is the transcript of a workflow recording:
    ${JSON.stringify(rawExtraction.transcript, null, 2)}
    
    Based on this transcript, create an organized workflow structure in the following JSON format:
    {
      "steps": [
        {
          "number": number (step number),
          "action": string (summary of action),
          "applications": string[] (list of applications used),
          "input": {
            "data": string (input data description),
            "source": string (where the data comes from)
          },
          "output": {
            "data": string (output data description),
            "destination": string (where the data goes)
          },
          "considerations": string[] (list of important considerations for this step)
        }
      ],
      "patterns": string[] (list of identified patterns in the workflow),
      "conditionalLogic": string[] (list of any if/then conditions identified),
      "triggers": string[] (events that initiate this workflow),
      "frequency": string (how often this workflow is performed)
    }
    
    Combine similar actions into cohesive steps, identify patterns, and extract any conditional logic.
    Use your judgment to infer information not explicitly stated in the transcript.
    Prioritize accurately reflecting the details present in the provided transcript when inferring missing information.
    `;
    
    try {
      const response = await this.anthropicClient.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: organizePrompt
          }
        ]
      });
      
      // Extract text from response
      const responseText = this.extractTextFromResponse(response.content);
      
      // Parse the response using the helper method
      const parsedResult = this._parseJsonResponse<OrganizedWorkflow>(responseText, 'organizeWorkflow');
      
      // LOGGING ADDED HERE
      console.log("--- Organized Workflow Output ---");
      console.log(JSON.stringify(parsedResult, null, 2));
      console.log("---------------------------------");
      return parsedResult;
    } catch (error) {
      // Catch API errors or parsing errors from the helper
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error calling Claude for workflow organization:", message);
      throw new Error(`AI service failed during workflow organization: ${message}`);
    }
  }
  
  async generateBlockStructure(organizedWorkflow: OrganizedWorkflow): Promise<BlockStructure> {
    console.log(`Generating block structure from organized workflow with ${organizedWorkflow.steps.length} steps`);
    
    const blockStructurePrompt = `
    I need to convert an organized workflow into a block-based structure representation.
    
    Here is the organized workflow:
    ${JSON.stringify(organizedWorkflow, null, 2)}
    
    Convert this workflow into a block structure with the following format:
    {
      "blocks": [
        {
          "id": string (unique ID),
          "type": string (one of: "document", "data", "presentation", "interface"),
          "title": string (short title),
          "description": string (detailed description),
          "properties": object (relevant properties for this block type)
        }
      ],
      "sources": [
        {
          "id": string (unique ID),
          "type": string (one of: "file", "web", "api", "manual"),
          "location": string (path or URL),
          "updateRules": string (one of: "onSourceChange", "manual", "scheduled", "onEvent")
        }
      ],
      "connections": [
        {
          "sourceBlockId": string (ID of source block),
          "targetBlockId": string (ID of target block),
          "dataType": string (type of data being passed),
          "updateRules": string (one of: "onSourceChange", "manual", "scheduled", "onEvent")
        }
      ]
    }
    
    Block types:
    - "document": For files, documents, or other content
    - "data": For databases, data processing operations, or data transformations
    - "presentation": For visualizations, reports, or presentations
    - "interface": For user interactions, notifications, or system interfaces
    
    Source types:
    - "file": Local or cloud file sources
    - "web": Web-based sources (URLs, web services)
    - "api": API-based data sources
    - "manual": Manually input data
    
    Update rules:
    - "onSourceChange": Update when the source changes
    - "manual": Only update when manually triggered
    - "scheduled": Update on a schedule
    - "onEvent": Update when a specific event occurs
    
    Ensure that:
    1. Each workflow step is represented by at least one block
    2. Blocks are connected based on data flow in the workflow
    3. IDs are unique and follow a consistent pattern
    4. Source information is captured accurately
    5. Block types are assigned based on the nature of each step
    `;
    
    try {
      const response = await this.anthropicClient.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: blockStructurePrompt
          }
        ]
      });
      
      // Extract text from response
      const responseText = this.extractTextFromResponse(response.content);
      
      // Parse the response using the helper method
      // Note: Validation of enums happens after parsing
      const parsedStructure = this._parseJsonResponse<any>(responseText, 'generateBlockStructure');
      
      // Ensure block types are valid enum values
      parsedStructure.blocks = parsedStructure.blocks.map((block: any) => {
        // Convert type string to enum
        const validTypes = Object.values(BlockType);
        if (!validTypes.includes(block.type)) {
          // Default to document if invalid
          block.type = BlockType.Document;
        }
        return block;
      });
      
      // Ensure source types are valid enum values
      parsedStructure.sources = parsedStructure.sources.map((source: any) => {
        // Convert type string to enum
        const validTypes = Object.values(SourceType);
        if (!validTypes.includes(source.type)) {
          // Default to file if invalid
          source.type = SourceType.File;
        }
        
        // Convert updateRules string to enum
        const validRules = Object.values(UpdateRule);
        if (!validRules.includes(source.updateRules)) {
          // Default to manual if invalid
          source.updateRules = UpdateRule.Manual;
        }
        return source;
      });
      
      // Ensure connection updateRules are valid enum values
      parsedStructure.connections = parsedStructure.connections.map((connection: any) => {
        // Convert updateRules string to enum
        const validRules = Object.values(UpdateRule);
        if (!validRules.includes(connection.updateRules)) {
          // Default to manual if invalid
          connection.updateRules = UpdateRule.Manual;
        }
        return connection;
      });
      
      // LOGGING ADDED HERE
      console.log("--- Generated Block Structure Output ---");
      console.log(JSON.stringify(parsedStructure, null, 2));
      console.log("----------------------------------------");
      
      return parsedStructure;
    } catch (error) {
      // Catch API errors or parsing errors from the helper
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error calling Claude for block structure generation:", message);
      throw new Error(`AI service failed during block structure generation: ${message}`);
    }
  }
}

export const aiService = new AIService();