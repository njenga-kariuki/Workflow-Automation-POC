import { BlockStructure, BlockType, SourceType, UpdateRule } from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
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
  private anthropicAPIKey: string;
  private geminiAPIKey: string;
  
  constructor() {
    this.anthropicAPIKey = process.env.ANTHROPIC_API_KEY || '';
    this.geminiAPIKey = process.env.GOOGLE_AI_API_KEY || '';
    
    this.anthropicClient = new Anthropic({
      apiKey: this.anthropicAPIKey,
    });
    
    this.geminiClient = new GoogleGenerativeAI(this.geminiAPIKey);
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
          description
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
    I need to create a structured transcript of a workflow video. 
    
    Here are descriptions of key frames from the video:
    ${frameDescriptions.map(fd => `Frame ${fd.frameIndex}: ${fd.description}`).join('\n\n')}
    
    ${audioTranscript ? `And here is the audio transcript from the video: ${audioTranscript}` : ''}
    
    Based on this information, generate a structured transcript of the workflow in the following JSON format:
    {
      "transcript": [
        {
          "time": number (timestamp in seconds),
          "screen": string (description of what's visible on screen),
          "action": string (user action being performed),
          "narration": string (what the user is saying, if available)
        }
      ]
    }
    
    Create at least 5-10 steps that would reasonably represent the workflow shown in these frames.
    If no audio transcript is available, you can infer reasonable narration based on the actions.
    Ensure the steps follow a logical progression.
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
      
      // Extract and parse the JSON from Claude's response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) ||
                        [null, responseText];
      
      const extractedJson = jsonMatch[1].trim();
      
      try {
        return JSON.parse(extractedJson);
      } catch (jsonError) {
        console.error("Failed to parse JSON from Claude response:", jsonError);
        console.log("Raw response:", responseText);
        
        // Fallback to a sample transcript
        return this.getSampleTranscript();
      }
    } catch (error) {
      console.error("Error calling Claude for transcript generation:", error);
      return this.getSampleTranscript();
    }
  }
  
  private getSampleTranscript(): RawWorkflowExtraction {
    return {
      transcript: [
        {
          time: 0,
          screen: "User opens Excel spreadsheet containing monthly sales data",
          action: "Double-clicks on file 'March2023.xlsx'",
          narration: "I'm starting with our monthly sales spreadsheet for March 2023"
        },
        {
          time: 15,
          screen: "Excel spreadsheet shows sales data with columns for regions, products, and amounts",
          action: "Selects cells B2:E20 and applies a filter",
          narration: "First I need to filter the data by region to separate sales by territory"
        },
        {
          time: 30,
          screen: "Excel spreadsheet with filtered data showing only North region sales",
          action: "Creates a SUM formula to calculate total sales",
          narration: "Now I'll calculate the total sales for the North region using SUM function"
        },
        {
          time: 45,
          screen: "Excel spreadsheet with summary section containing calculated totals",
          action: "Copies data and switches to PowerPoint",
          narration: "I'll now transfer this summary data to our quarterly report presentation"
        },
        {
          time: 60,
          screen: "PowerPoint slide with title 'Quarterly Sales Report'",
          action: "Creates a new slide and pastes the data",
          narration: "I'm creating a new slide for our March sales data"
        },
        {
          time: 75,
          screen: "PowerPoint slide with pasted data and inserting chart",
          action: "Creates bar chart from the data",
          narration: "Now I'll visualize this data with a bar chart for easier comprehension"
        },
        {
          time: 90,
          screen: "PowerPoint with completed slide containing formatted chart and data",
          action: "Saves presentation and switches to Outlook",
          narration: "Once the slide is formatted, I save the presentation and prepare to email it"
        },
        {
          time: 105,
          screen: "Outlook new email window",
          action: "Creates new email, adds recipients from team list",
          narration: "Now I need to email this report to the team including our managers"
        },
        {
          time: 120,
          screen: "Outlook email with attachment and written message",
          action: "Attaches PowerPoint file and writes email body",
          narration: "I attach the presentation and write a brief summary of the key findings"
        },
        {
          time: 135,
          screen: "Outlook email ready to send",
          action: "Clicks send button",
          narration: "Finally, I send the email to distribute the report to stakeholders"
        }
      ]
    };
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
      
      // Extract and parse the JSON from Claude's response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) ||
                        [null, responseText];
      
      const extractedJson = jsonMatch[1].trim();
      
      try {
        return JSON.parse(extractedJson);
      } catch (jsonError) {
        console.error("Failed to parse JSON from Claude response:", jsonError);
        console.log("Raw response:", responseText);
        
        // Fallback to a sample organization
        return this.getSampleOrganizedWorkflow();
      }
    } catch (error) {
      console.error("Error calling Claude for workflow organization:", error);
      return this.getSampleOrganizedWorkflow();
    }
  }
  
  private getSampleOrganizedWorkflow(): OrganizedWorkflow {
    return {
      steps: [
        {
          number: 1,
          action: "Open source data file",
          applications: ["Microsoft Excel"],
          input: {
            data: "Monthly sales spreadsheet",
            source: "Local file system"
          },
          output: {
            data: "Raw sales data",
            destination: "Excel worksheet"
          },
          considerations: ["Ensure most recent file version is used"]
        },
        {
          number: 2,
          action: "Filter and process data",
          applications: ["Microsoft Excel"],
          input: {
            data: "Raw sales data",
            source: "Excel worksheet"
          },
          output: {
            data: "Filtered and summarized sales data",
            destination: "Excel worksheet"
          },
          considerations: ["Apply correct regional filters", "Verify formula accuracy"]
        },
        {
          number: 3,
          action: "Create visualization",
          applications: ["Microsoft PowerPoint"],
          input: {
            data: "Filtered and summarized sales data",
            source: "Excel worksheet"
          },
          output: {
            data: "Visual sales report",
            destination: "PowerPoint presentation"
          },
          considerations: ["Use consistent chart formatting", "Include all relevant data points"]
        },
        {
          number: 4,
          action: "Distribute report",
          applications: ["Microsoft Outlook"],
          input: {
            data: "Visual sales report",
            source: "PowerPoint presentation"
          },
          output: {
            data: "Delivered report",
            destination: "Stakeholder email inboxes"
          },
          considerations: ["Include all required recipients", "Provide context in email body"]
        }
      ],
      patterns: ["Monthly reporting cycle", "Regional data filtering before summary"],
      conditionalLogic: ["If data contains errors, note discrepancies in email"],
      triggers: ["Month-end closing", "Request from management"],
      frequency: "Monthly"
    };
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
      
      // Extract and parse the JSON from Claude's response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) ||
                        [null, responseText];
      
      const extractedJson = jsonMatch[1].trim();
      
      try {
        const parsedStructure = JSON.parse(extractedJson);
        
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
        
        return parsedStructure;
      } catch (jsonError) {
        console.error("Failed to parse JSON from Claude response:", jsonError);
        console.log("Raw response:", responseText);
        
        // Fallback to a sample block structure
        return this.getSampleBlockStructure();
      }
    } catch (error) {
      console.error("Error calling Claude for block structure generation:", error);
      return this.getSampleBlockStructure();
    }
  }
  
  private getSampleBlockStructure(): BlockStructure {
    return {
      blocks: [
        {
          id: "block-1",
          type: BlockType.Data,
          title: "Excel Spreadsheet",
          description: "Source data from monthly sales spreadsheet",
          properties: {
            format: "xlsx",
            location: "/Documents/Sales/March2023.xlsx"
          }
        },
        {
          id: "block-2",
          type: BlockType.Data,
          title: "Data Formatting",
          description: "Format sales data by region and apply calculations",
          properties: {
            functions: ["SUM", "AVERAGE", "FILTER"],
            application: "Microsoft Excel"
          }
        },
        {
          id: "block-3",
          type: BlockType.Presentation,
          title: "Sales Report",
          description: "Generate formatted quarterly sales report",
          properties: {
            format: "pptx",
            outputType: "Presentation"
          }
        },
        {
          id: "block-4",
          type: BlockType.Interface,
          title: "Email Notification",
          description: "Send email with report to stakeholders",
          properties: {
            application: "Microsoft Outlook",
            recipients: "Sales Team, Management"
          }
        }
      ],
      sources: [
        {
          id: "source-1",
          type: SourceType.File,
          location: "/Documents/Sales/March2023.xlsx",
          updateRules: UpdateRule.OnSourceChange
        }
      ],
      connections: [
        {
          sourceBlockId: "block-1",
          targetBlockId: "block-2",
          dataType: "spreadsheet-data",
          updateRules: UpdateRule.OnSourceChange
        },
        {
          sourceBlockId: "block-2",
          targetBlockId: "block-3",
          dataType: "formatted-data",
          updateRules: UpdateRule.OnSourceChange
        },
        {
          sourceBlockId: "block-2",
          targetBlockId: "block-4",
          dataType: "notification-trigger",
          updateRules: UpdateRule.OnSourceChange
        }
      ]
    };
  }
}

export const aiService = new AIService();