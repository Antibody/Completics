// components/MoveToMenu.tsx
import React from 'react';

import { StageData } from './KanbanBoard'; // Import StageData

interface MoveToMenuProps {
  taskId: string;
  currentStageId: string;
  stages: StageData[]; // Use StageData
  onMove: (taskId: string, targetStageId: string) => void;
}

const MoveToMenu: React.FC<MoveToMenuProps> = ({
  taskId,
  currentStageId,
  stages,
  onMove,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const { value } = e.target;
    if (value !== currentStageId) onMove(taskId, value);
  };

  return (
    <select
      aria-label="Move task"
      value={currentStageId}
      onChange={handleChange}
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '0.85em',
        background: '#fff',
      }}
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.title}
        </option>
      ))}
    </select>
  );
};

export default MoveToMenu;
