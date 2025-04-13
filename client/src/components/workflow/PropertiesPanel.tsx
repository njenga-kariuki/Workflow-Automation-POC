import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Block, BlockIntent, UpdateRule } from "@shared/schema";

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
          <Label htmlFor="block-intent">Block Intent</Label>
          <Select
            value={blockData.intent}
            onValueChange={(value) => handleChange('intent', value as BlockIntent)}
          >
            <SelectTrigger id="block-intent">
              <SelectValue placeholder="Select block intent" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(BlockIntent).map((intentValue) => (
                <SelectItem key={intentValue} value={intentValue}>
                  {intentValue.charAt(0).toUpperCase() + intentValue.slice(1)}
                </SelectItem>
              ))}
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
