import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Upload, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const FileUpload = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string>('');
  
  const validateFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'mov') {
      setValidationError('Please upload a QuickTime (.mov) file.');
      return false;
    }
    if (file.size > 300 * 1024 * 1024) {
      setValidationError('File size exceeds 300MB limit.');
      return false;
    }
    setValidationError(null);
    return true;
  };
  
  const handleFile = useCallback((selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      setUploadSuccess(false);
      setWorkflowId(null);
    }
  }, []);
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };
  
  const handleUploadClick = () => {
    if (uploading || uploadSuccess) return;
    fileInputRef.current?.click();
  };
  
  const handleProcessWorkflow = async () => {
    if (!uploadSuccess || !workflowId) return;
    
    try {
      const processResponse = await fetch(`/api/workflow/${workflowId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      
      if (!processResponse.ok) {
          const errorText = await processResponse.text();
          throw new Error(errorText || `Failed to start processing: ${processResponse.statusText}`);
      }
      
      setLocation(`/processing/${workflowId}`);
    } catch (error) {
      console.error('Error starting workflow processing:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start workflow processing",
        variant: "destructive"
      });
    }
  };
  
  const uploadFile = async () => {
    if (!file) return;
    
    setUploading(true);
    setUploadSuccess(false);
    setValidationError(null);
    setUploadProgress(0);
    setUploadStatusMessage('Initiating upload...');
    
    let uploadUrl = '';
    let gcsPath = '';
    const title = file.name.replace(/\.mov$/i, '');

    try {
      setUploadProgress(10);
      const initiateResponse = await fetch('/api/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            filename: file.name, 
            contentType: file.type || 'video/quicktime',
            title: title
        }),
        credentials: 'include'
      });

      if (!initiateResponse.ok) {
        const errorText = await initiateResponse.text();
        throw new Error(`Initiation failed: ${errorText || initiateResponse.statusText}`);
      }

      const initiateData = await initiateResponse.json();
      uploadUrl = initiateData.uploadUrl;
      gcsPath = initiateData.gcsPath;
      
      if (!uploadUrl || !gcsPath) {
          throw new Error('Server did not return a valid upload URL or GCS path.');
      }

      setUploadProgress(30);
      setUploadStatusMessage('Uploading to storage...');
      
      const gcsUploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/quicktime' },
        body: file,
      });

      if (!gcsUploadResponse.ok) {
        const errorText = await gcsUploadResponse.text();
        throw new Error(`GCS upload failed: ${errorText || gcsUploadResponse.statusText}`);
      }
      
      setUploadProgress(70);
      setUploadStatusMessage('Finalizing workflow creation...');

      const createWorkflowResponse = await fetch('/api/workflow/create', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
             gcsPath: gcsPath,
             title: title,
         }),
         credentials: 'include'
      });

      if (!createWorkflowResponse.ok) {
        const errorText = await createWorkflowResponse.text();
        throw new Error(`Workflow creation failed: ${errorText || createWorkflowResponse.statusText}`);
      }

      const workflowData = await createWorkflowResponse.json();
      
      setUploadProgress(100);
      setUploadSuccess(true);
      setUploading(false);
      setWorkflowId(workflowData.id);
      setUploadStatusMessage('Upload complete!');
      
      toast({
        title: "Success",
        description: "File uploaded and workflow created!",
        variant: "default"
      });

    } catch (error) {
      console.error('Error during upload process:', error);
      setValidationError(error instanceof Error ? error.message : 'Upload process failed');
      setUploading(false);
      setUploadSuccess(false);
      setUploadProgress(0);
      setUploadStatusMessage('Upload failed.');
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Upload failed',
        variant: "destructive"
      });
    }
  };
  
  const handleBackClick = () => {
    setLocation("/instructions");
  };
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">Upload Your Workflow Recording</h1>
        <p className="mt-2 text-lg text-gray-600">We accept QuickTime (.mov) recordings up to 300MB and 5 minutes</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-8">
        <div 
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors relative ${
            isDragging ? 'border-primary bg-blue-50' : 'border-gray-300'
          } ${uploading || uploadSuccess ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={!uploading && !uploadSuccess ? handleUploadClick : undefined} 
          onDragEnter={!uploading && !uploadSuccess ? handleDragEnter : undefined}
          onDragLeave={!uploading && !uploadSuccess ? handleDragLeave : undefined}
          onDragOver={!uploading && !uploadSuccess ? handleDragOver : undefined}
          onDrop={!uploading && !uploadSuccess ? handleDrop : undefined}
        >
          {(uploading || uploadSuccess) && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex flex-col items-center justify-center z-10 rounded-lg">
              </div>
          )}
          
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4 flex text-sm text-gray-600 justify-center">
            <label 
               htmlFor={!uploading && !uploadSuccess ? "file-upload" : undefined} 
               className={`relative bg-white rounded-md font-medium text-primary ${!uploading && !uploadSuccess ? 'hover:text-blue-600 cursor-pointer' : 'cursor-default'} focus-within:outline-none`}
            >
              <span>Upload a file</span>
              <input 
                id="file-upload" 
                ref={fileInputRef} 
                name="file-upload" 
                type="file" 
                className="sr-only" 
                accept=".mov"
                onChange={handleFileInputChange}
                disabled={uploading || uploadSuccess}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">QuickTime (.mov) up to 300MB</p>
          
          {file && !uploading && !uploadSuccess && (
            <div className="mt-4 text-sm">
              <p>Selected file: <span className="font-medium">{file.name}</span></p>
              <p className="text-xs text-gray-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <Button 
                className="mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  uploadFile();
                }}
              >
                Start Upload
              </Button>
            </div>
          )}
        </div>

        {(uploading || validationError || uploadSuccess) && (
           <div className="mt-6">
             {uploading && (
               <>
                 <div className="flex justify-between mb-1">
                   <span className="text-sm font-medium text-gray-700">{uploadStatusMessage}</span>
                   <span className="text-sm font-medium text-gray-700">{uploadProgress}%</span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2.5">
                   <div 
                     className="bg-primary h-2.5 rounded-full transition-width duration-300 ease-linear" 
                     style={{ width: `${uploadProgress}%` }}
                   ></div>
                 </div>
               </>
             )}
             
             {validationError && !uploading && (
               <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                 <div className="flex">
                   <div className="flex-shrink-0">
                     <AlertCircle className="h-5 w-5 text-red-400" />
                   </div>
                   <div className="ml-3">
                     <p className="text-sm text-red-700">
                       {validationError}
                     </p>
                   </div>
                 </div>
               </div>
             )}
             
             {uploadSuccess && (
               <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-4">
                 <div className="flex">
                   <div className="flex-shrink-0">
                     <Check className="h-5 w-5 text-green-400" />
                   </div>
                   <div className="ml-3">
                     <p className="text-sm text-green-700">
                       {uploadStatusMessage} Click 'Process Workflow' to continue.
                     </p>
                   </div>
                 </div>
               </div>
             )}
           </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Button 
          size="lg"
          onClick={handleProcessWorkflow}
          disabled={!uploadSuccess || !workflowId || uploading}
          className={!uploadSuccess || !workflowId || uploading ? 'bg-gray-400 cursor-not-allowed' : ''}
        >
          Process Workflow
        </Button>
        <p className="mt-3 text-sm text-gray-500">
          Or go back to{" "}
          <button
            onClick={handleBackClick}
            className="text-primary hover:text-blue-600"
          >
            instructions
          </button>
        </p>
      </div>
    </div>
  );
};
