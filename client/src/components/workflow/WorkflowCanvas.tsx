import { useCallback, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  NodeTypes,
  MarkerType,
  Panel,
  NodeMouseHandler,
  NodeProps,
  Background,
  Handle,
  Position
} from "reactflow";
import "reactflow/dist/style.css";
import { Block, BlockIntent, Connection } from "@shared/schema";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Database, 
  Presentation, 
  Layout, 
  Edit, 
  Search, 
  Bot, 
  ArrowRightLeft, 
  MessageSquare,
  MousePointer,
  Eye,
  DownloadCloud,
  AlertTriangle,
  HelpCircle
} from "lucide-react";

// Define custom node component
const CustomBlockNode = ({ data }: NodeProps<Block>) => {
  // Function to get styles based on BlockIntent
  const getBlockStyles = () => {
    switch (data.intent) { 
      case BlockIntent.EDIT:
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: <Edit className="h-4 w-4 text-blue-600" />,
          iconBg: "bg-blue-100"
        };
      case BlockIntent.VIEW:
        return {
          bg: "bg-gray-50",
          border: "border-gray-300",
          icon: <Eye className="h-4 w-4 text-gray-600" />,
          iconBg: "bg-gray-100"
        };
      case BlockIntent.SEARCH:
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          icon: <Search className="h-4 w-4 text-yellow-600" />,
          iconBg: "bg-yellow-100"
        };
      case BlockIntent.GENERATE:
        return {
          bg: "bg-purple-50",
          border: "border-purple-200",
          icon: <Bot className="h-4 w-4 text-purple-600" />,
          iconBg: "bg-purple-100"
        };
      case BlockIntent.INPUT:
        return {
          bg: "bg-green-50",
          border: "border-green-200",
          icon: <MousePointer className="h-4 w-4 text-green-600" />,
          iconBg: "bg-green-100"
        };
      case BlockIntent.EXTRACT:
          return {
            bg: "bg-indigo-50",
            border: "border-indigo-200",
            icon: <DownloadCloud className="h-4 w-4 text-indigo-600" />,
            iconBg: "bg-indigo-100"
          };
      case BlockIntent.TRANSFER:
        return {
          bg: "bg-teal-50",
          border: "border-teal-200",
          icon: <ArrowRightLeft className="h-4 w-4 text-teal-600" />,
          iconBg: "bg-teal-100"
        };
      case BlockIntent.DECISION:
          return {
            bg: "bg-orange-50",
            border: "border-orange-200",
            icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
            iconBg: "bg-orange-100"
          };
      case BlockIntent.COMMUNICATE:
        return {
          bg: "bg-pink-50",
          border: "border-pink-200",
          icon: <MessageSquare className="h-4 w-4 text-pink-600" />,
          iconBg: "bg-pink-100"
        };
      case BlockIntent.UNKNOWN:
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-300",
          icon: <HelpCircle className="h-4 w-4 text-gray-600" />,
          iconBg: "bg-gray-100"
        };
    }
  };
  
  // Call the function to get styles
  const styles = getBlockStyles();
  
  // Return the JSX structure for the node
  return (
    <div className={cn(
      styles.bg, 
      styles.border, 
      "border rounded-lg p-4 w-64 shadow-sm relative"
    )}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
      
      <div className="flex items-center mb-2">
        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", styles.iconBg)}>
          {styles.icon}
        </div>
        <h3 className="ml-2 font-medium text-gray-900">{data.title}</h3>
      </div>
      
      <p className="text-sm text-gray-500">{data.description}</p>
    </div>
  );
};

interface WorkflowCanvasProps {
  blocks: Block[];
  connections: Connection[];
  onSelectBlock: (id: string) => void;
  selectedBlockId: string | null;
}

// Define the node types for React Flow
const nodeTypes: NodeTypes = {
  blockNode: CustomBlockNode,
};

export const WorkflowCanvas = ({ 
  blocks, 
  connections, 
  onSelectBlock,
  selectedBlockId
}: WorkflowCanvasProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Convert our Block objects to React Flow Nodes
  const createNodes = useCallback(() => {
    if (!blocks || blocks.length === 0) return [];
    
    // Create a grid layout for initial node positions
    const gridSize = Math.ceil(Math.sqrt(blocks.length));
    const cellWidth = 300;
    const cellHeight = 200;
    
    return blocks.map((block, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      return {
        id: block.id,
        type: 'blockNode',
        data: block,
        position: { x: 50 + col * cellWidth, y: 50 + row * cellHeight },
        selected: block.id === selectedBlockId,
      };
    });
  }, [blocks, selectedBlockId]);
  
  // Convert our Connection objects to React Flow Edges
  const createEdges = useCallback(() => {
    if (!connections || connections.length === 0) return [];
    
    return connections.map((connection) => {
      return {
        id: `edge-${connection.sourceBlockId}-${connection.targetBlockId}`,
        source: connection.sourceBlockId,
        target: connection.targetBlockId,
        type: 'smoothstep',
        animated: connection.updateRules === 'onSourceChange',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
        },
        style: { strokeWidth: 2 },
      };
    });
  }, [connections]);
  
  // Update nodes and edges when blocks or connections change
  useEffect(() => {
    setNodes(createNodes());
    setEdges(createEdges());
  }, [blocks, connections, selectedBlockId, createNodes, createEdges, setNodes, setEdges]);
  
  // Handle node selection
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    onSelectBlock(node.id);
  }, [onSelectBlock]);
  
  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          elementsSelectable={true}
          attributionPosition="bottom-right"
        >
          <Controls />
          <Background color="#f8f8f8" gap={12} size={1} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
};
