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
  Background
} from "reactflow";
import "reactflow/dist/style.css";
import { Block, BlockType, Connection } from "@shared/schema";
import { cn } from "@/lib/utils";
import { FileText, Database, Presentation, Layout } from "lucide-react";

// Define custom node component
const CustomBlockNode = ({ data }: NodeProps<Block>) => {
  const getBlockStyles = () => {
    switch (data.type) {
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
  
  return (
    <div className={cn(
      styles.bg, 
      styles.border, 
      "border rounded-lg p-4 w-64 shadow-sm"
    )}>
      <div className="flex items-center mb-2">
        <div className={`h-6 w-6 rounded-full ${styles.iconBg} flex items-center justify-center`}>
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
        label: connection.dataType,
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
