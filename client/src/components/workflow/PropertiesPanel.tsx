import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Block, BlockType, UpdateRule } from "@shared/schema";

interface PropertiesPanelProps {
  selectedBlock: Block | null;
  onUpdateBlock: (updatedBlock: Block) => void;
}

export const PropertiesPanel = ({ selectedBlock, onUpdateBlock }: PropertiesPanelProps) => {
  const [blockData, setBlockData] = useState<Block | null>(null);
  
  useEffect(() => {
    setBlockData(selectedBlock);
  }, [selectedBlock]);
  
  if (!blockData) {
    return (
      <div className="p-4">
        <p className="text-gray-500 text-sm">Select a block to view and edit its properties</p>
      </div>
    );
  }
  
  const handleChange = (field: keyof Block, value: any) => {
    setBlockData(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };
  
  const handlePropertyChange = (key: string, value: any) => {
    setBlockData(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        properties: {
          ...prev.properties,
          [key]: value
        }
      };
    });
  };
  
  const handleSave = () => {
    if (blockData) {
      onUpdateBlock(blockData);
    }
  };
  
  return (
    <div className="p-4">
      <h3 className="font-medium text-gray-900 mb-3">{blockData.title}</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="block-type">Block Type</Label>
          <Select
            value={blockData.type}
            onValueChange={(value) => handleChange('type', value as BlockType)}
          >
            <SelectTrigger id="block-type">
              <SelectValue placeholder="Select block type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BlockType.Data}>Data Block</SelectItem>
              <SelectItem value={BlockType.Document}>Document Block</SelectItem>
              <SelectItem value={BlockType.Presentation}>Presentation Block</SelectItem>
              <SelectItem value={BlockType.Interface}>Interface Block</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="block-title">Title</Label>
          <Input
            id="block-title"
            value={blockData.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="block-description">Description</Label>
          <Textarea
            id="block-description"
            rows={3}
            value={blockData.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>
        
        {/* Dynamic properties based on block type */}
        {blockData.type === BlockType.Data && (
          <>
            <div>
              <Label htmlFor="block-functions">Functions</Label>
              <Input
                id="block-functions"
                value={Array.isArray(blockData.properties.functions) 
                  ? blockData.properties.functions.join(', ') 
                  : blockData.properties.functions || ''}
                onChange={(e) => handlePropertyChange('functions', e.target.value.split(', '))}
              />
            </div>
          </>
        )}
        
        {blockData.type === BlockType.Document && (
          <div>
            <Label htmlFor="block-format">Format</Label>
            <Input
              id="block-format"
              value={blockData.properties.format as string || ''}
              onChange={(e) => handlePropertyChange('format', e.target.value)}
            />
          </div>
        )}
        
        {blockData.type === BlockType.Presentation && (
          <div>
            <Label htmlFor="block-output-type">Output Type</Label>
            <Input
              id="block-output-type"
              value={blockData.properties.outputType as string || ''}
              onChange={(e) => handlePropertyChange('outputType', e.target.value)}
            />
          </div>
        )}
        
        {blockData.type === BlockType.Interface && (
          <div>
            <Label htmlFor="block-application">Application</Label>
            <Input
              id="block-application"
              value={blockData.properties.application as string || ''}
              onChange={(e) => handlePropertyChange('application', e.target.value)}
            />
          </div>
        )}
        
        <div>
          <Label htmlFor="update-rules">Update Rules</Label>
          <Select
            value={(blockData.properties.updateRules as UpdateRule) || UpdateRule.OnSourceChange}
            onValueChange={(value) => handlePropertyChange('updateRules', value as UpdateRule)}
          >
            <SelectTrigger id="update-rules">
              <SelectValue placeholder="Select update rule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UpdateRule.OnSourceChange}>When source changes</SelectItem>
              <SelectItem value={UpdateRule.Manual}>Manual trigger only</SelectItem>
              <SelectItem value={UpdateRule.Scheduled}>On schedule</SelectItem>
              <SelectItem value={UpdateRule.OnEvent}>On external event</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end space-x-3">
        <Button variant="outline">
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
