import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Upload, Check, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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
  
  const validateFile = (file: File): boolean => {
    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'mov') {
      setValidationError('Please upload a QuickTime (.mov) file.');
      return false;
    }
    
    // Check file size (300MB max)
    if (file.size > 300 * 1024 * 1024) {
      setValidationError('File size exceeds 300MB limit.');
      return false;
    }
    
    setValidationError(null);
    return true;
  };
  
  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setFile(file);
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
    fileInputRef.current?.click();
  };
  
  const handleProcessWorkflow = async () => {
    if (!file || !workflowId) return;
    
    try {
      await apiRequest('POST', `/api/workflow/${workflowId}/process`, {});
      
      // Redirect to processing page
      setLocation(`/processing/${workflowId}`);
    } catch (error) {
      console.error('Error starting workflow processing:', error);
      toast({
        title: "Error",
        description: "Failed to start workflow processing",
        variant: "destructive"
      });
    }
  };
  
  const uploadFile = async () => {
    if (!file) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace('.mov', ''));
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 200);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }
      
      setUploadProgress(100);
      setUploadSuccess(true);
      
      const data = await response.json();
      setWorkflowId(data.workflowId);
      
      toast({
        title: "Success",
        description: "File uploaded successfully!",
        variant: "default"
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      setValidationError(error instanceof Error ? error.message : 'Upload failed');
      setUploading(false);
      
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
        {/* Upload Component */}
        <div 
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging ? 'border-primary bg-blue-50' : 'border-gray-300'
          } ${uploading || uploadSuccess ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
          onClick={handleUploadClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4 flex text-sm text-gray-600 justify-center">
            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-blue-600 focus-within:outline-none">
              <span>Upload a file</span>
              <input 
                id="file-upload" 
                ref={fileInputRef} 
                name="file-upload" 
                type="file" 
                className="sr-only" 
                accept=".mov"
                onChange={handleFileInputChange}
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
                Upload
              </Button>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {uploading && (
          <div className="mt-6">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Uploading...</span>
              <span className="text-sm font-medium text-gray-700">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Validation Feedback */}
        {validationError && (
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

        {/* Successfully Uploaded */}
        {uploadSuccess && (
          <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  File successfully uploaded! Click 'Process Workflow' to continue.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Button 
          size="lg"
          onClick={handleProcessWorkflow}
          disabled={!uploadSuccess || !workflowId}
          className={!uploadSuccess || !workflowId ? 'bg-gray-400 cursor-not-allowed' : ''}
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
