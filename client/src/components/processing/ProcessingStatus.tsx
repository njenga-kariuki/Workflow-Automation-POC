import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProcessingStatusProps {
  workflowId: number;
}

interface WorkflowStatus {
  status: string;
  progress: {
    videoProcessing: number;
    rawExtraction: number;
    organization: number;
    blockGeneration: number;
    overall: number;
  };
  estimatedTimeRemaining?: number;
}

export const ProcessingStatus = ({ workflowId }: ProcessingStatusProps) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/workflow/${workflowId}/status`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching workflow status: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(data);
      
      // If completed, stop polling and redirect to workflow viewer
      if (data.status === 'completed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        setTimeout(() => {
          setLocation(`/workflow/${workflowId}`);
        }, 1000);
      }
      
      // If failed, stop polling and show error
      if (data.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setError('Processing failed. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };
  
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'calculating...';
    
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) {
      return `${minutes} minutes`;
    }
    
    return `${minutes} minutes, ${remainingSeconds} seconds`;
  };
  
  const handleRetry = async () => {
    try {
      setError(null);
      
      // Call API to retry processing
      await apiRequest('POST', `/api/workflow/${workflowId}/process`, {});
      
      // Start polling again
      startPolling();
      
      toast({
        title: "Processing restarted",
        description: "Your workflow is being processed again",
        variant: "default"
      });
    } catch (err) {
      console.error('Error retrying:', err);
      setError(err instanceof Error ? err.message : 'Failed to restart processing');
      
      toast({
        title: "Error",
        description: "Failed to restart processing",
        variant: "destructive"
      });
    }
  };
  
  const handleCancel = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    setLocation('/upload');
  };
  
  const startPolling = () => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Initial fetch
    fetchStatus();
    
    // Set up polling every 2 seconds
    const interval = setInterval(fetchStatus, 2000);
    setPollingInterval(interval);
  };
  
  useEffect(() => {
    startPolling();
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [workflowId]);
  
  const getStepStatus = (stepProgress: number) => {
    if (stepProgress === 0) return "pending";
    if (stepProgress === 100) return "completed";
    return "processing";
  };
  
  // Add a loading state check at the beginning of the return
  if (!status) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Processing Your Workflow</h1>
          <p className="mt-2 text-lg text-gray-600">Loading status...</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
        </div>
      </div>
    );
  }
  
  // If status is not null, proceed with rendering the detailed view
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">Processing Your Workflow</h1>
        <p className="mt-2 text-lg text-gray-600">Please wait while our AI analyzes your recording</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-8">
        {/* Overall Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-1">
            <span className="text-lg font-medium text-gray-700">Overall Progress</span>
            <span className="text-lg font-medium text-gray-700">{status?.progress?.overall || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-primary h-4 rounded-full" 
              style={{ width: `${status?.progress?.overall || 0}%` }}
            ></div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Estimated time remaining: {formatTimeRemaining(status?.estimatedTimeRemaining)}
          </p>
        </div>

        {/* Individual Steps */}
        <div className="space-y-6">
          {/* Video Processing */}
          <div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${
                  getStepStatus(status?.progress?.videoProcessing || 0) === "completed" 
                    ? "bg-green-100 text-green-500"
                    : getStepStatus(status?.progress?.videoProcessing || 0) === "processing"
                    ? "bg-blue-100 text-blue-500"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {getStepStatus(status?.progress?.videoProcessing || 0) === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : getStepStatus(status?.progress?.videoProcessing || 0) === "processing" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="h-5 w-5 text-center text-sm font-medium">1</span>
                  )}
                </div>
              </div>
              <div className="ml-3 w-full">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-gray-900">Video Processing</h3>
                  <span className="text-sm font-medium text-gray-500">{status?.progress?.videoProcessing || 0}%</span>
                </div>
                <div className="mt-1.5 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      getStepStatus(status?.progress?.videoProcessing || 0) === "completed"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${status?.progress?.videoProcessing || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Extraction */}
          <div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${
                  getStepStatus(status?.progress?.rawExtraction || 0) === "completed" 
                    ? "bg-green-100 text-green-500"
                    : getStepStatus(status?.progress?.rawExtraction || 0) === "processing"
                    ? "bg-blue-100 text-blue-500"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {getStepStatus(status?.progress?.rawExtraction || 0) === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : getStepStatus(status?.progress?.rawExtraction || 0) === "processing" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="h-5 w-5 text-center text-sm font-medium">2</span>
                  )}
                </div>
              </div>
              <div className="ml-3 w-full">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-gray-900">Gemini 2.0 Raw Extraction</h3>
                  <span className="text-sm font-medium text-gray-500">{status?.progress?.rawExtraction || 0}%</span>
                </div>
                <div className="mt-1.5 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      getStepStatus(status?.progress?.rawExtraction || 0) === "completed"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${status?.progress?.rawExtraction || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Organization */}
          <div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${
                  getStepStatus(status?.progress?.organization || 0) === "completed" 
                    ? "bg-green-100 text-green-500"
                    : getStepStatus(status?.progress?.organization || 0) === "processing"
                    ? "bg-blue-100 text-blue-500"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {getStepStatus(status?.progress?.organization || 0) === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : getStepStatus(status?.progress?.organization || 0) === "processing" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="h-5 w-5 text-center text-sm font-medium">3</span>
                  )}
                </div>
              </div>
              <div className="ml-3 w-full">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-gray-900">Claude 3.7 Organization</h3>
                  <span className="text-sm font-medium text-gray-500">{status?.progress?.organization || 0}%</span>
                </div>
                <div className="mt-1.5 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      getStepStatus(status?.progress?.organization || 0) === "completed"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${status?.progress?.organization || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Block Structure Generation */}
          <div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full ${
                  getStepStatus(status?.progress?.blockGeneration || 0) === "completed" 
                    ? "bg-green-100 text-green-500"
                    : getStepStatus(status?.progress?.blockGeneration || 0) === "processing"
                    ? "bg-blue-100 text-blue-500"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {getStepStatus(status?.progress?.blockGeneration || 0) === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : getStepStatus(status?.progress?.blockGeneration || 0) === "processing" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="h-5 w-5 text-center text-sm font-medium">4</span>
                  )}
                </div>
              </div>
              <div className="ml-3 w-full">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-gray-900">Claude 3.7 Block Structure Generation</h3>
                  <span className="text-sm font-medium text-gray-500">{status?.progress?.blockGeneration || 0}%</span>
                </div>
                <div className="mt-1.5 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      getStepStatus(status?.progress?.blockGeneration || 0) === "completed"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${status?.progress?.blockGeneration || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error handling */}
        {error && (
          <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
                <div className="mt-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleRetry}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Button 
          variant="outline"
          onClick={handleCancel}
        >
          Cancel Processing
        </Button>
      </div>
    </div>
  );
};
