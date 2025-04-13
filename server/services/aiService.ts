import { BlockStructure, BlockIntent, SourceType, UpdateRule } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
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

interface OrganizedWorkflowStep {
  number: number;
  action: string;
  applications: string[];
  primaryApplication?: string;
  input: {
    data: string;
    source: string;
  };
  output: {
    data: string;
    destination: string;
  };
  considerations: string[];
}

interface OrganizedWorkflow {
  steps: OrganizedWorkflowStep[];
  patterns: string[];
  conditionalLogic: string[];
  triggers: string[];
  frequency: string;
}

export class AIService {
  private anthropicClient: Anthropic;
  private geminiClient: GoogleGenerativeAI;
  private speechClient: SpeechClient;
  private storageClient: Storage;
  private anthropicAPIKey: string;
  private geminiAPIKey: string;
  private gcsBucketName: string;
  
  constructor() {
    // --- Add Debug Log Here ---
    // console.log("DEBUG: Reading GOOGLE_APPLICATION_CREDENTIALS env var:", process.env.GOOGLE_APPLICATION_CREDENTIALS); // No longer reading this one
    console.log("DEBUG: Checking for GOOGLE_APPLICATION_CREDENTIALS_JSON env var existence:", !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    // --- End Debug Log ---
    
    this.anthropicAPIKey = process.env.ANTHROPIC_API_KEY || '';
    this.geminiAPIKey = process.env.GOOGLE_AI_API_KEY || '';
    this.gcsBucketName = process.env.GCS_BUCKET_NAME || '';
    // No longer need keyFilePath property
    // this.keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS; 
    
    let googleCredentials: Record<string, any> | undefined = undefined;
    const credentialsJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!this.gcsBucketName) {
        console.warn("GCS_BUCKET_NAME environment variable not set. Transcription of long audio files will fail.");
    }

    if (credentialsJsonString) {
        try {
            googleCredentials = JSON.parse(credentialsJsonString);
            console.log("Successfully parsed GOOGLE_APPLICATION_CREDENTIALS_JSON.");
        } catch (e) {
            console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON. Google Cloud services might fail.", e);
        }
    } else {
        console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set. Google Cloud services might fail.");
    }
    
    this.anthropicClient = new Anthropic({
      apiKey: this.anthropicAPIKey,
    });
    
    this.geminiClient = new GoogleGenerativeAI(this.geminiAPIKey);
    
    // Initialize Google Cloud clients explicitly using the parsed credentials object
    // The constructors accept 'undefined' for credentials, falling back to default discovery
    this.speechClient = new SpeechClient({ credentials: googleCredentials }); 
    this.storageClient = new Storage({ credentials: googleCredentials });
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
    
    if (!this.gcsBucketName) {
        console.error("GCS Bucket Name not configured. Cannot transcribe long audio.");
        return ''; // Cannot proceed without a bucket
    }

    const originalFilename = path.basename(audioPath);
    const gcsObjectName = `temp-transcribe-audio/${uuidv4()}-${originalFilename}`; // Unique name in GCS
    const gcsUri = `gs://${this.gcsBucketName}/${gcsObjectName}`;
    let uploaded = false;

    try {
        // --- Upload to GCS --- 
        console.log(`Uploading ${audioPath} to ${gcsUri}...`);
        await this.storageClient.bucket(this.gcsBucketName).upload(audioPath, {
            destination: gcsObjectName,
            // Optional: Add metadata if needed
        });
        uploaded = true;
        console.log(`Successfully uploaded audio to ${gcsUri}`);
        // --- End Upload ---
        
        // Configure transcription request using GCS URI
        const audio = {
            uri: gcsUri, // Use GCS URI instead of inline content
        };
        const config = {
            // No need for encoding/sampleRateHertz when using URI with WAV?
            // API generally infers from the file itself
            languageCode: 'en-US',
            model: 'latest_long',
            enableAutomaticPunctuation: true,
        };
        const request = {
            audio: audio,
            config: config,
        };

        console.log('Sending long running recognize request to Google Cloud Speech-to-Text using GCS URI...');
        const [operation] = await this.speechClient.longRunningRecognize(request);

        console.log('Waiting for transcription operation to complete...');
        const [response] = await operation.promise();
        console.log('Transcription operation completed.');

        if (!response.results || response.results.length === 0) {
            console.warn(`Transcription result empty for ${gcsUri}`);
            return '';
        }

        const transcription = response.results
            .map(result => result.alternatives![0].transcript)
            .join('\n');

        console.log(`Transcription successful for ${gcsUri}. Length: ${transcription.length}`);
        return transcription;

    } catch (error) {
        console.error(`Failed to transcribe audio from ${gcsUri || audioPath}:`, error);
        return '';
    } finally {
        // --- GCS Cleanup --- 
        if (uploaded) {
            console.log(`Attempting cleanup of GCS object: ${gcsUri}`);
            try {
                await this.storageClient.bucket(this.gcsBucketName).file(gcsObjectName).delete();
                console.log(`Successfully deleted GCS object: ${gcsUri}`);
            } catch (cleanupError) {
                console.error(`Error deleting GCS object ${gcsUri}:`, cleanupError);
                // Log error but don't throw, transcription might have succeeded
            }
        }
        // --- End GCS Cleanup ---
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
    Your primary goal is to organize and structure a workflow based on the provided transcript, which includes frame descriptions and user narration.
    Accurately identify the logical workflow steps, their actions, inputs, outputs, and considerations, maintaining the established level of detail and structure.

    Here is the transcript of a workflow recording:
    ${JSON.stringify(rawExtraction.transcript, null, 2)}

    Based on this transcript, create an organized workflow structure in the following JSON format. Ensure the output strictly adheres to this schema:
    {
      "steps": [
        {
          "number": number (sequential step number starting from 1),
          "action": string (detailed summary of the primary action performed in this step),
          "applications": string[] (list *all* applications visible or mentioned during this step),
          "primaryApplication": string | null (the *single main application* actively used or focused on during this step. Use its common name like 'Microsoft Excel', 'Google Chrome', 'Finder'. If unclear, use null),
          "input": {
            "data": string (description of the input data for the action),
            "source": string (where the input data comes from, e.g., application name, specific file, user input)
          },
          "output": {
            "data": string (description of the output data or result of the action),
            "destination": string (where the output goes, e.g., application name, specific file, clipboard)
          },
          "considerations": string[] (list of important nuances, goals, or context mentioned by the user for this specific step)
        }
        // ... more steps
      ],
      "patterns": string[] (list of identified recurring patterns or loops in the overall workflow),
      "conditionalLogic": string[] (list of any explicit if/then conditions mentioned),
      "triggers": string[] (list of events that typically initiate this workflow),
      "frequency": string (how often this workflow is performed, e.g., 'daily', 'weekly', 'as needed')
    }

    Instructions:
    1.  Combine related low-level actions from the transcript into cohesive, logical steps.
    2.  For each step, meticulously extract the 'action', 'input', 'output', and 'considerations' based *only* on the provided transcript.
    3.  Populate the 'applications' array with all software mentioned or visually identified in the context of the step.
    4.  **Critically analyze** the context of each step (action, user focus, narration) to determine the single 'primaryApplication'. This is the application where the core work of the step happens. If multiple applications are involved, choose the one most central to the step's action. If the primary application cannot be determined with high confidence, explicitly use \`null\`.
    5.  Analyze the overall workflow to identify 'patterns', 'conditionalLogic', 'triggers', and 'frequency'.
    6.  Ensure the final output is a single, valid JSON object conforming exactly to the specified structure.
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
    
    // Define the available BlockIntent enum values for the prompt
    const intentValues = Object.values(BlockIntent).join('", "');

    // Enhanced prompt for generateBlockStructure focusing on BlockIntent
    const blockStructurePrompt = `\n    Your task is to convert the provided 'OrganizedWorkflow' JSON object into the 'BlockStructure' JSON format specified below. \n    Focus on accurately mapping the workflow steps to blocks, determining the correct user intent, and transferring information correctly.\n\n    Here is the organized workflow input:\n    ${JSON.stringify(organizedWorkflow, null, 2)}\n\n    Convert this workflow into the following 'BlockStructure' JSON format. Ensure the output strictly adheres to this schema:\n    {\n      \"blocks\": [\n        {\n          \"id\": string (generate a unique, descriptive ID for each block, e.g., \"step-1-excel-edit\"),\n          \"intent\": string (Assign ONE intent that best describes the primary user action in the step. Choose from: \"${intentValues}\". Analyze the 'action', 'input', 'output', 'primaryApplication' fields to determine the most fitting intent.),\n          \"title\": string (create a concise title. Recommended format: '[Action Summary] in [Primary Application]' if primaryApplication exists, otherwise just '[Action Summary]'),\n          \"description\": string (use the 'action' description from the input step, possibly augmented with 'considerations'),\n          \"properties\": object (keep this empty {} for now),\n          \"applicationName\": string | null (copy the value *directly* from the 'primaryApplication' field of the corresponding input step. If the input field is null or missing, omit this field or set it to null in the output block.)\n        }\n        // ... more blocks corresponding to steps\n      ],\n      \"sources\": [\n        {\n          \"id\": string (unique ID for the source),\n          \"type\": string (one of: \"file\", \"web\", \"api\", \"manual\", infer based on input source description),\n          \"location\": string (path, URL, or description from input source),\n          \"updateRules\": string (default to \"manual\" unless specified otherwise in workflow patterns/triggers)\n        }\n        // ... identify distinct sources from workflow inputs\n      ],\n      \"connections\": [\n        {\n          \"sourceBlockId\": string (ID of the block providing the data),\n          \"targetBlockId\": string (ID of the block receiving the data),\n          \"dataType\": string (describe the data flowing, based on step inputs/outputs),\n          \"updateRules\": string (default to \"onSourceChange\" for direct data flow, or \"manual\")\n        }\n        // ... define connections based on data flow between steps (output of one step is input to another)\n      ]\n    }\n\n    Intent Guidelines (Choose ONE per block):
    - '${BlockIntent.EDIT}': Modifying existing content (text, data, images, settings).
    - '${BlockIntent.VIEW}': Primarily observing or reading information.
    - '${BlockIntent.SEARCH}': Actively looking for specific information within an application or the web.
    - '${BlockIntent.GENERATE}': Creating substantially new content, potentially using AI assistance or complex tools.
    - '${BlockIntent.INPUT}': Manually entering data into specific fields or forms.
    - '${BlockIntent.EXTRACT}': Copying or isolating specific pieces of data from a larger source.
    - '${BlockIntent.TRANSFER}': Moving data between applications or locations (e.g., copy/paste, download/upload, export/import).
    - '${BlockIntent.DECISION}': If the step represents a clear conditional branch point (less common).
    - '${BlockIntent.COMMUNICATE}': If the primary action is sending information (e.g., composing/sending email).
    - '${BlockIntent.UNKNOWN}': Use ONLY if the intent is genuinely ambiguous or cannot be determined from the context.

    Instructions:
    1.  Create one or more blocks for each step in the 'organizedWorkflow.steps' array.
    2.  **Critically analyze** the step's 'action', context, and 'primaryApplication' to determine the most accurate 'intent' from the provided list. Assign this value to the 'intent' field.
    3.  Handle the 'applicationName' and 'title' fields as previously instructed (copying 'primaryApplication' and formatting the title).
    4.  Generate unique and descriptive 'id' values for all blocks and sources.
    5.  Derive 'sources' from the unique input sources identified in the workflow steps.
    6.  Create 'connections' representing the data flow described by the input/output fields between steps/blocks.
    7.  Maintain all previously established requirements for generating descriptions, properties, sources, and connections accurately.
    8.  Ensure the final output is a single, valid JSON object conforming exactly to the specified structure, using the correct enum values for 'intent'.\n    `;

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
      const parsedStructure = this._parseJsonResponse<any>(responseText, 'generateBlockStructure');
      
      // Ensure block intents are valid enum values
      parsedStructure.blocks = parsedStructure.blocks.map((block: any) => {
        const validIntents = Object.values(BlockIntent);
        if (!validIntents.includes(block.intent)) {
          console.warn(`Invalid BlockIntent '${block.intent}' received for block ID '${block.id}'. Defaulting to UNKNOWN.`);
          block.intent = BlockIntent.UNKNOWN; // Default to unknown if invalid
        }
        // Ensure applicationName is either a string or excluded (handle null from LLM)
        if (block.applicationName === null) {
           delete block.applicationName; // Remove the key if null
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