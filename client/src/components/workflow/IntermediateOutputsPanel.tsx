import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface IntermediateOutputsPanelProps {
  rawExtraction: any;
  organizedWorkflow: any;
}

export const IntermediateOutputsPanel = ({ 
  rawExtraction,
  organizedWorkflow 
}: IntermediateOutputsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const formatJson = (data: any) => {
    if (!data) return 'No data available.';
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error stringifying JSON:', error);
      return 'Error formatting data.';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button 
        onClick={toggleOpen}
        className="w-full p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-50 focus:outline-none"
      >
        <h2 className="text-lg font-semibold text-gray-900">Intermediate AI Outputs</h2>
        {isOpen ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
      </button>
      
      {isOpen && (
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Raw Extraction (Gemini)</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm text-gray-700 overflow-x-auto">
              {formatJson(rawExtraction)}
            </pre>
          </div>
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Organized Workflow (Claude)</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm text-gray-700 overflow-x-auto">
              {formatJson(organizedWorkflow)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}; 