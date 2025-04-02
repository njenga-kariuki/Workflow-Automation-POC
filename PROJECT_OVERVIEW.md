# Data Jaw: PoC Implementation - Core Workflow Capture & Visualization

## 1. Context & Goal (The Why)

### Product Vision
Data Jaw eliminates the frustration of repeatedly rebuilding information workflows. Our core promise is "Show us once, never do it again." We automate recurring tasks by observing user demonstrations.

### Core Problem We Solve
We target "workflow repeaters" (freelancers, small business owners, productivity enthusiasts) who lose 4-6 hours weekly to painful inefficiencies:
*   **The "setup tax":** Starting similar tasks from scratch every time.
*   **The "change cascade":** Manually updating multiple documents when source info changes.
*   **The "format fight":** Struggling to maintain consistent appearance in outputs.
*   **The "technical barrier":** Finding automation tools too complex or requiring coding skills.

### Data Jaw Solution
We observe your workflow once (via screen recording + narration), create persistent connections between your data sources and outputs, and automatically update everything when sources change, maintaining your formatting – no coding needed.

### POC Details
We're creating a proof-of-concept (POC) for Data Jaw's core value proposition: "Show us once, never do it again." This POC will demonstrate our ability to:
1.  Capture a user's workflow through screen recording with audio narration
2.  Process and understand this multimodal input
3.  Transform it into a structured workflow representation
4.  Present it back to the user as an interactive block-based diagram

### Why This Matters
Our target users (freelancers, small business owners, and productivity enthusiasts) waste 4-6 hours weekly rebuilding similar workflows. This POC validates our ability to solve this pain point by demonstrating that we can:
*   Accurately capture and understand user workflows from a single demonstration
*   Convert unstructured demonstrations into structured workflows
*   Present workflows in an intuitive, editable format

The success of this POC will validate our core technical hypothesis and set the foundation for the full product.

## 2. Technical Architecture Overview
The POC consists of five key components:
1.  **Landing Page & Workflow Recorder UI:** Introduces the product and guides users through recording their workflow
2.  **Video Processing Pipeline:** Handles uploaded recordings and prepares them for AI analysis
3.  **Multimodal Analysis Pipeline (Gemini 2.0 Flash & Claude 3.5):** Extracts raw workflow information from the recording
4.  **Block Structure Generation (Claude 3.5):** Converts workflow information into a block-based representation
5.  **Interactive Workflow Viewer:** Displays the generated workflow to the user for validation and editing

## 3. Implementation Details

### 3.1 Landing Page & User Flow

**Landing Page Requirements**
*   Create a visually appealing, simple landing page that clearly communicates our value proposition
*   Headline: "Show us once, never do it again"
*   Subheadline: Focus on the problem of repeated workflows for our target segment
*   Three-step process visualization: Record → Process → Automate
*   Prominent "Get Started" button

**Recording Instructions Page**
*   Clear, step-by-step instructions for recording workflow with audio
*   Focus on macOS/QuickTime for this POC
*   Instructions should include:
    *   Opening QuickTime Player and selecting "New Screen Recording"
    *   Selecting the microphone from the dropdown menu
    *   Recording only the relevant applications for the workflow
    *   Speaking clearly to explain actions as they're performed
    *   Keeping recordings under 5 minutes for optimal processing
    *   Saving the recording when complete

**Video Upload Component**
*   Drag-and-drop interface for file upload
*   Support for .mov (QuickTime) format
*   File validation checks:
    *   Format validation (QuickTime .mov)
    *   Size validation (max 300MB)
    *   Duration validation (max 5 minutes)
*   Feedback on validation issues
*   Upload progress indicator

### 3.2 Video Processing Pipeline

**Backend Processing Service**
*   Receive uploaded video files securely
*   Store videos in a secure, temporary cloud storage location
*   Perform basic preprocessing:
    *   Convert to standard format if needed (WebM or MP4)
    *   Ensure audio track is properly extracted
    *   Validate video quality is sufficient for processing
*   Generate unique workflow ID for tracking through system
*   Create processing job and place in queue

### 3.3 Multimodal Analysis Pipeline (gemini-2.0-flash & claude 3.7 sonnet)
This pipeline uses gemini-2.0-flash & claude 3.7 sonnet to extract raw workflow information from the recording in two distinct steps:

**Step 1: Raw Workflow Extraction (gemini-2.0-flash)**
*   **Input:** Processed video file with audio
*   **Process:**
    *   Frame extraction at regular intervals
    *   Process frames to identify visible applications, UI elements, and user actions
    *   Transcribe audio narration with timestamps
    *   Pass frames, transcription, and timing information to gemini-2.0-flash
*   **Output:** Structured chronological transcript of the workflow with timestamps, screen states, actions, and narration

**Step 2: Workflow Organization (claude 3.7 sonnet)**
*   **Input:** Raw extraction output from Step 1, passed from gemini flash output
*   **Process:** Pass the raw extraction to claude 3.7 sonnet with a system prompt focused on organization
*   **Output:** Structured JSON representing the organized workflow steps, applications, data flows, and considerations

### 3.4 Block Structure Generation (Claude 3.5)
*   **Input:** Organized workflow from claude 3.7 sonnet (Step 2 output)
*   **Process:** Pass the organized workflow to Claude 3.7 sonnet to generate a block-based representation
*   **Output:** Formal block-based workflow JSON structure following Data Jaw's architecture

### 3.5 Interactive Workflow Viewer
*   **Input:** Block-based workflow structure from Claude 3.7 sonnet
*   **Features:**
    *   Visual rendering of blocks, sources, and connections
    *   Color-coding by block type
    *   Zoom and pan navigation for larger workflows
    *   Click interaction to view block details
    *   Simple editing capabilities:
        *   Edit block titles and descriptions
        *   Edit connection properties
        *   Add/remove connections
        *   Rearrange blocks
    *   "Run Workflow" button (simulated for POC)
    *   "Save Workflow" button
    *   Export options (PDF, PNG)
*   **UI Components:**
    *   Main canvas for workflow visualization
    *   Properties panel for selected elements
    *   Toolbar with common actions
    *   Minimap for navigation of complex workflows

### 3.6 Processing Status UI
*   Create a clear, informative processing status page that shows:
    *   Video processing status
    *   Gemini 2.0 flash Raw Extraction progress
    *   Claude 3.5 Organization progress
    *   Claude 3.5 Block Structure Generation progress
    *   Overall completion percentage
    *   Estimated time remaining
    *   Error handling with retry options

## 4. Technical Implementation Guidelines

### Frontend Technologies
*   **Framework:** React with TypeScript
*   **State Management:** React Context API or Redux
*   **Styling:** Tailwind CSS
*   **Component Library:** Headless UI components
*   **Diagram Rendering:** React Flow for interactive workflow diagrams
*   **Video Processing:** Use browser APIs for initial validation

### Backend Technologies
*   **API:** Node.js with Express
*   **Video Processing:** FFmpeg for video manipulation
*   **Storage:** AWS S3 for temporary video storage
*   **AI Integration:** Google Gemini API (gemini 2.0 flash) and Anthropic API (Claude 3.7 sonnet)
*   **Authentication:** Simple JWT for the POC
*   **Deployment:** Docker containers on AWS ECS

### API Endpoints
1.  `/api/upload` - Handles video upload and initial processing
2.  `/api/workflow/extract` - Triggers gemini 2.0 flash raw extraction
3.  `/api/workflow/organize` - Triggers claude 3.7 sonnet workflow organization
4.  `/api/workflow/generate-blocks` - Triggers Claude 3.7 sonnet block structure generation
5.  `/api/workflow/{id}` - Returns current workflow state
6.  `/api/workflow/{id}/status` - Returns processing status
7.  `/api/workflow/{id}/update` - Handles workflow edits

---

## POC Requirements:

Data Jaw: Proof-of-Concept Implementation

Based on your requirements document, I will build a proof-of-concept (PoC) application for Data Jaw that demonstrates the core workflow capture and visualization capability. Here are the detailed requirements:

### Core Requirements
1.  **Landing Page**
    *   Visually appealing, simple landing page with clear value proposition
    *   Headline: "Show us once, never do it again"
    *   Subheadline focusing on repeated workflow problems
    *   Three-step process visualization: Record → Process → Automate
    *   Prominent "Get Started" button
2.  **Recording Instructions Page**
    *   Clear step-by-step instructions for recording workflow with audio
    *   Focus on macOS/QuickTime recording
    *   Guidelines for effective recording (application focus, clear audio, time limits)
3.  **Video Upload Component**
    *   Drag-and-drop interface for file upload
    *   Support for .mov (QuickTime) format
    *   File validation (format, size, duration)
    *   Upload progress indicator
    *   Error handling and feedback
4.  **Video Processing Pipeline**
    *   Secure video file handling
    *   Basic preprocessing of uploaded videos
    *   Unique workflow ID generation
    *   Processing job queue management
5.  **AI-Powered Analysis Pipeline**
    *   Integration with Gemini 2.0 Flash for raw workflow extraction
    *   Integration with Claude 3.7 for workflow organization
    *   Structured JSON output generation
6.  **Block Structure Generation**
    *   Claude 3.7 integration for block-based representation
    *   Formal JSON structure following Data Jaw's architecture
7.  **Interactive Workflow Viewer**
    *   Visual rendering of blocks, sources, and connections
    *   Color-coding by block type
    *   Navigation capabilities (zoom, pan)
    *   Basic editing functionality
    *   Export options (PDF, PNG)
    *   "Run Workflow" and "Save Workflow" buttons (simulated for PoC)
8.  **Processing Status UI**
    *   Clear visualization of processing stages
    *   Progress indicators for each step
    *   Estimated time remaining
    *   Error handling with retry options

### Technical Implementation
*   **Frontend:** React with TypeScript, Tailwind CSS, React Flow for diagrams
*   **Backend:** Express.js, AI API integrations (Google Gemini, Anthropic Claude)
*   **Data handling:** Server-side in-memory storage for the MVP

This PoC will demonstrate Data Jaw's core value proposition of "Show us once, never do it again" by capturing user workflows via video recording and transforming them into interactive, editable block-based diagrams. 