import { useState } from "react";
import { BlockType, Block as BlockData } from "@shared/schema";
import { 
  FileText, 
  Database, 
  Presentation, 
  Layout,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface BlockProps {
  block: BlockData;
  position: { x: number; y: number };
  selected: boolean;
  onSelect: (id: string) => void;
}

export const Block = ({ block, position, selected, onSelect }: BlockProps) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  
  const getBlockStyles = () => {
    switch (block.type) {
      case BlockType.Document:
        return {
          bg: "bg-gray-50",
          border: "border-gray-300",
          icon: <FileText className="h-4 w-4 text-green-600" />,
          iconBg: "bg-green-100"
        };
      case BlockType.Data:
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: <Database className="h-4 w-4 text-blue-600" />,
          iconBg: "bg-blue-100"
        };
      case BlockType.Presentation:
        return {
          bg: "bg-purple-50",
          border: "border-purple-200",
          icon: <Presentation className="h-4 w-4 text-purple-600" />,
          iconBg: "bg-purple-100"
        };
      case BlockType.Interface:
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          icon: <Layout className="h-4 w-4 text-yellow-600" />,
          iconBg: "bg-yellow-100"
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-300",
          icon: <FileText className="h-4 w-4 text-gray-600" />,
          iconBg: "bg-gray-100"
        };
    }
  };
  
  const styles = getBlockStyles();
  
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };
  
  return (
    <div 
      className={`absolute ${styles.bg} ${styles.border} border rounded-lg p-4 w-64 shadow-sm cursor-pointer transition-all ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      style={{ 
        left: position.x,
        top: position.y,
        zIndex: selected ? 10 : 1
      }}
      onClick={() => onSelect(block.id)}
    >
      <div className="flex items-center mb-2">
        <div className={`h-6 w-6 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          {styles.icon}
        </div>
        <h3 className="ml-2 font-medium text-gray-900">{block.title}</h3>
        <button 
          className="ml-auto text-gray-400 hover:text-gray-600"
          onClick={toggleExpanded}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      
      <p className="text-sm text-gray-500">{block.description}</p>
      
      {expanded && (
        <div className="mt-3 text-xs bg-white/50 rounded p-2 space-y-2">
          {Object.entries(block.properties).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium">{key}: </span>
              <span className="text-gray-600">
                {Array.isArray(value) 
                  ? value.join(', ') 
                  : typeof value === 'object' 
                    ? JSON.stringify(value)
                    : String(value)
                }
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
