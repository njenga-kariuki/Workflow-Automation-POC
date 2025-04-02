import { create } from 'zustand';
import { Block, BlockStructure } from '@shared/schema';

interface WorkflowState {
  currentWorkflowId: number | null;
  blockStructure: BlockStructure | null;
  selectedBlockId: string | null;
  isEditing: boolean;
  
  // Actions
  setCurrentWorkflow: (workflowId: number) => void;
  setBlockStructure: (blockStructure: BlockStructure) => void;
  setSelectedBlockId: (blockId: string | null) => void;
  updateBlock: (updatedBlock: Block) => void;
  toggleEditing: () => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  currentWorkflowId: null,
  blockStructure: null,
  selectedBlockId: null,
  isEditing: false,
  
  setCurrentWorkflow: (workflowId) => {
    set({ currentWorkflowId: workflowId });
  },
  
  setBlockStructure: (blockStructure) => {
    set({ blockStructure });
  },
  
  setSelectedBlockId: (blockId) => {
    set({ selectedBlockId: blockId });
  },
  
  updateBlock: (updatedBlock) => {
    set((state) => {
      if (!state.blockStructure) return state;
      
      const updatedBlocks = state.blockStructure.blocks.map(block => 
        block.id === updatedBlock.id ? updatedBlock : block
      );
      
      return {
        blockStructure: {
          ...state.blockStructure,
          blocks: updatedBlocks
        }
      };
    });
  },
  
  toggleEditing: () => {
    set((state) => ({ isEditing: !state.isEditing }));
  },
  
  reset: () => {
    set({
      currentWorkflowId: null,
      blockStructure: null,
      selectedBlockId: null,
      isEditing: false
    });
  }
}));
