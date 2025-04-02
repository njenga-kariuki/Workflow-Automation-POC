import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { WorkflowViewer } from "@/components/workflow/WorkflowViewer";
import { useQuery } from "@tanstack/react-query";
import { workflowApi, WorkflowData } from "@/lib/api";
import { useWorkflowStore } from "@/lib/workflowStore";

export default function WorkflowPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const workflowId = id ? parseInt(id) : null;
  
  const setCurrentWorkflow = useWorkflowStore(state => state.setCurrentWorkflow);
  const setBlockStructure = useWorkflowStore(state => state.setBlockStructure);
  
  // Fetch workflow data
  const { data: workflow, isLoading, error } = useQuery<WorkflowData>({ 
    queryKey: [`/api/workflow/${workflowId}`],
    enabled: !!workflowId,
  });
  
  useEffect(() => {
    if (!workflowId) {
      setLocation("/upload");
      return;
    }
    
    // Set current workflow in store
    setCurrentWorkflow(workflowId);
    
    // Set block structure in store if available
    if (workflow?.blockStructure) {
      setBlockStructure(workflow.blockStructure);
    }
  }, [workflowId, workflow]);
  
  if (!workflowId) {
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading workflow...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !workflow) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error Loading Workflow</h2>
          <p className="text-gray-500 mb-4">
            {error instanceof Error ? error.message : "Failed to load workflow data"}
          </p>
          <button 
            className="text-primary hover:text-blue-600"
            onClick={() => setLocation("/upload")}
          >
            Return to Upload
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-9rem)]">
      <WorkflowViewer workflowId={workflowId} workflow={workflow} />
    </div>
  );
}
