import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { Block, BlockStructure, Workflow } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Download,
  Edit,
  Play,
} from "lucide-react";
import { IntermediateOutputsPanel } from "./IntermediateOutputsPanel";

interface WorkflowViewerProps {
  workflowId: number;
  workflow: Workflow;
}

export const WorkflowViewer = ({ workflowId, workflow }: WorkflowViewerProps) => {
  const { toast } = useToast();
  
  const [blockStructure, setBlockStructure] = useState<BlockStructure | null>(
    null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  useEffect(() => {
    const initialBlockStructure = workflow.blockStructure as BlockStructure | null;
    setBlockStructure(initialBlockStructure);
  }, [workflow.blockStructure]);
  
  const handleSelectBlock = (id: string) => {
    setSelectedBlockId(id);
  };
  
  const getSelectedBlock = (): Block | null => {
    if (!selectedBlockId || !blockStructure) return null;
    return blockStructure.blocks.find(block => block.id === selectedBlockId) || null;
  };
  
  const handleUpdateBlock = async (updatedBlock: Block) => {
    if (!blockStructure) return;
    
    // Update the block in the local state
    const updatedBlocks = blockStructure.blocks.map(block => 
      block.id === updatedBlock.id ? updatedBlock : block
    );
    
    const updatedBlockStructure: BlockStructure = {
      ...blockStructure,
      blocks: updatedBlocks
    };
    
    setBlockStructure(updatedBlockStructure);
    
    try {
      // Update the block structure on the server
      await apiRequest('PUT', `/api/workflow/${workflowId}/blocks`, updatedBlockStructure);
      
      toast({
        title: "Success",
        description: "Block updated successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Error updating block:', error);
      
      toast({
        title: "Error",
        description: "Failed to update block",
        variant: "destructive"
      });
    }
  };
  
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };
  
  const handleRunWorkflow = () => {
    toast({
      title: "Workflow Execution",
      description: "This feature will be available in the full product",
      variant: "default"
    });
  };
  
  const handleExportWorkflow = () => {
    if (!blockStructure) return;
    
    // Create a downloadable JSON file
    const dataStr = JSON.stringify(blockStructure, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `workflow-${workflowId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Export Complete",
      description: `Workflow exported as ${exportFileDefaultName}`,
      variant: "default"
    });
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };
  
  if (!blockStructure) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6">
          <p className="text-gray-500 mb-4">No workflow data available</p>
          <Button onClick={() => window.location.href = '/instructions'}>
            Create New Workflow
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-6 py-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{workflow.title || "Your Workflow"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Created on {formatDate(String(workflow.createdAt))} • Last edited {formatTime(String(workflow.updatedAt))}
          </p>
        </div>
        <div className="flex space-x-3 shrink-0">
          <Button variant="outline" onClick={handleExportWorkflow}>
            <Download className="mr-2 h-4 w-4 text-gray-500" />
            Export
          </Button>
          <Button variant="outline" onClick={handleToggleEdit}>
            <Edit className="mr-2 h-4 w-4 text-gray-500" />
            {isEditing ? 'View' : 'Edit'}
          </Button>
          <Button onClick={handleRunWorkflow}>
            <Play className="mr-2 h-4 w-4" />
            Run Workflow
          </Button>
        </div>
      </div>

      <div className="p-6 flex-1 flex gap-8 overflow-y-auto">
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Workflow Diagram</h2>
          </div>
          <div className="h-[calc(100%-57px)] overflow-hidden">
            <WorkflowCanvas 
              blocks={blockStructure.blocks}
              connections={blockStructure.connections}
              onSelectBlock={handleSelectBlock}
              selectedBlockId={selectedBlockId}
            />
          </div>
        </div>

        <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Properties</h2>
          </div>
          <PropertiesPanel 
            selectedBlock={getSelectedBlock()}
            onUpdateBlock={handleUpdateBlock}
          />
        </div>
      </div>

      {/* Intermediate Outputs Panel */}
      <div className="px-6 pb-6">
        <IntermediateOutputsPanel 
          rawExtraction={(workflow as Workflow).rawExtraction}
          organizedWorkflow={(workflow as Workflow).organizedWorkflow}
        />
      </div>
    </div>
  );
};
