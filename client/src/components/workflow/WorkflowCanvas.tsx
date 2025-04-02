import { useState, useRef, useEffect } from "react";
import { Block as BlockComponent } from "./Block";
import { Block, Connection } from "@shared/schema";

interface WorkflowCanvasProps {
  blocks: Block[];
  connections: Connection[];
  onSelectBlock: (id: string) => void;
  selectedBlockId: string | null;
}

interface Position {
  x: number;
  y: number;
}

interface BlockPosition {
  [blockId: string]: Position;
}

export const WorkflowCanvas = ({ 
  blocks, 
  connections, 
  onSelectBlock,
  selectedBlockId
}: WorkflowCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [blockPositions, setBlockPositions] = useState<BlockPosition>({});
  const [scale, setScale] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  
  // Initialize block positions
  useEffect(() => {
    if (blocks.length && Object.keys(blockPositions).length === 0) {
      const positions: BlockPosition = {};
      
      // Simple automatic layout algorithm
      // Place blocks in a grid layout
      const gridSize = Math.ceil(Math.sqrt(blocks.length));
      const cellWidth = 300;
      const cellHeight = 150;
      
      blocks.forEach((block, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        
        positions[block.id] = {
          x: 50 + col * cellWidth,
          y: 50 + row * cellHeight
        };
      });
      
      setBlockPositions(positions);
    }
  }, [blocks]);
  
  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 2));
  };
  
  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      setOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Draw connection arrows between blocks
  const renderConnections = () => {
    return connections.map((connection, index) => {
      const sourcePos = blockPositions[connection.sourceBlockId];
      const targetPos = blockPositions[connection.targetBlockId];
      
      if (!sourcePos || !targetPos) {
        return null;
      }
      
      // Calculate arrow points
      const sourceX = sourcePos.x + 140; // center of source block
      const sourceY = sourcePos.y + 40;
      const targetX = targetPos.x + 40;
      const targetY = targetPos.y + 40;
      
      // Draw a curved line
      const path = `M${sourceX},${sourceY} C${sourceX + 50},${sourceY} ${targetX - 50},${targetY} ${targetX},${targetY}`;
      
      return (
        <svg 
          key={`connection-${index}`}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        >
          <path 
            d={path} 
            stroke="#9CA3AF" 
            strokeWidth="2" 
            fill="none" 
            strokeDasharray="4 4"
          />
          <path 
            d={`M${targetX-5},${targetY-5} L${targetX},${targetY} L${targetX-5},${targetY+5}`}
            stroke="#9CA3AF" 
            strokeWidth="2" 
            fill="none"
          />
        </svg>
      );
    });
  };
  
  return (
    <div className="relative h-full overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex space-x-2">
        <button 
          className="p-1 rounded-md hover:bg-gray-100"
          onClick={handleZoomIn}
        >
          <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button 
          className="p-1 rounded-md hover:bg-gray-100"
          onClick={handleZoomOut}
        >
          <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
          </svg>
        </button>
      </div>
      
      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="w-full h-full cursor-grab overflow-auto"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.2s'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className="relative w-[2000px] h-[1000px]"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
          }}
        >
          {/* Connection lines */}
          {renderConnections()}
          
          {/* Blocks */}
          {blocks.map((block) => (
            <BlockComponent
              key={block.id}
              block={block}
              position={blockPositions[block.id] || { x: 0, y: 0 }}
              selected={block.id === selectedBlockId}
              onSelect={onSelectBlock}
            />
          ))}
        </div>
      </div>
      
      {/* Minimap (simplified) */}
      <div className="absolute bottom-4 right-4 w-40 h-40 border border-gray-200 rounded bg-white/90 shadow-sm overflow-hidden">
        <div className="w-full h-full relative">
          {blocks.map((block) => {
            const pos = blockPositions[block.id];
            if (!pos) return null;
            
            return (
              <div
                key={`minimap-${block.id}`}
                className="absolute w-4 h-4 rounded-sm bg-primary opacity-70"
                style={{
                  left: (pos.x / 2000) * 100 + '%',
                  top: (pos.y / 1000) * 100 + '%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            );
          })}
          
          {/* Viewport indicator */}
          <div 
            className="absolute border-2 border-primary rounded opacity-50"
            style={{
              left: `${Math.max(0, 50 - ((window.innerWidth / 2) / 20))}%`,
              top: `${Math.max(0, 50 - ((window.innerHeight / 2) / 10))}%`,
              width: `${Math.min(100, (window.innerWidth / 20))}%`,
              height: `${Math.min(100, (window.innerHeight / 10))}%`,
              transform: `translate(${-offset.x / 20}%, ${-offset.y / 10}%)`
            }}
          />
        </div>
      </div>
    </div>
  );
};
