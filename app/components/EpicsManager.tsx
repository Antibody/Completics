// app/components/EpicsManager.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import KanbanTask from './KanbanTask';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  useDroppable,
  UseDroppableArguments, // Added
} from '@dnd-kit/core';


interface Epic {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  start_date?: string | null;
  finish_date?: string | null;
}

interface AssociatedCard {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  order: number;
  due_date?: string | null;
  epic_id?: string | null;
  version_id?: string | null;
  is_archived?: boolean;
  board_id: string; // NEW
}

interface ColumnData {
  id: string;
  title: string;
  order: number;
}

interface VersionForSelect {
  id: string;
  name: string;
}

// Define DroppableEpicColumn component
interface DroppableEpicColumnProps {
  column: ColumnData;
  cardsInColumn: AssociatedCard[];
  allProjects: Epic[];
  allVersions: VersionForSelect[];
  onUpdateCard: (cardId: string, updates: {
    title?: string;
    description?: string | null; // Changed to allow null
    due_date?: string | null;
    project_id?: string | null; // Changed from epic_id
    ver_id?: string | null; // Changed from version_id
    is_archived?: boolean;
  }) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onArchiveCard: (cardId: string) => Promise<void>;
  styles: Record<string, React.CSSProperties>; // Pass styles object
}

const DroppableEpicColumn: React.FC<DroppableEpicColumnProps> = ({
  column,
  cardsInColumn,
  allProjects,
  allVersions,
  onUpdateCard,
  onDeleteCard,
  onArchiveCard,
  styles,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  } as UseDroppableArguments); // Added type assertion for UseDroppableArguments

  return (
    <div
      ref={setNodeRef}
      style={{
        ...styles.dndContextContainer, // Assuming this style is for individual columns or similar
        flex: '0 0 300px',
        padding: '8px',
        backgroundColor: isOver ? 'var(--column-border-hover)' : 'var(--column-bg)',
        borderRadius: '8px',
        maxHeight: '100%', // Ensure it fits within cardsPanel
        overflowY: 'auto',
        marginRight: '16px', // Add some spacing between columns
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', color: 'var(--foreground)' }}>{column.title}</h3>
      {cardsInColumn.length === 0 && <p style={{ color: 'var(--text-subtle)' }}>No cards here.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {cardsInColumn.map(card => (
          <KanbanTask
            key={card.id}
            id={card.id}
            title={card.title}
            description={card.description ?? undefined}
            stage_id={card.column_id}
            order={card.order}
            due_date={card.due_date ?? undefined}
            project_id={card.epic_id ?? undefined}
            ver_id={card.version_id ?? undefined}
            is_archived={card.is_archived ?? false}
            allProjects={allProjects}
            allVers={allVersions}
            onUpdateTask={onUpdateCard}
            onDeleteTask={onDeleteCard}
            onArchiveTask={onArchiveCard}
            workspaceId={card.board_id} // Ensure boardId is passed
          />
        ))}
      </ul>
    </div>
  );
};

const EpicsManager: React.FC = () => {
  const { session, user } = useAuth();
  const { refetchFilterData } = useFilters();

  const styles = {
    container: { display: 'flex', height: 'calc(100vh - 56px)', backgroundColor: 'var(--background)' },
    epicsListPanel: { width: '350px', padding: '16px', borderRight: '1px solid var(--card-border)', overflowY: 'auto', backgroundColor: 'var(--background-surface)', display: 'flex', flexDirection: 'column' },
    cardsPanel: { flexGrow: 1, padding: '16px', overflowY: 'auto', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' },
    formSection: { marginBottom: '20px', padding: '15px', border: '1px solid var(--input-border)', borderRadius: '8px', backgroundColor: 'var(--card-bg)' },
    inputGroup: { marginBottom: '10px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: 500, color: 'var(--foreground-secondary)' },
    input: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--input-border)', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)' },
    button: { padding: '8px 12px', borderRadius: '4px', border: 0, cursor: 'pointer', backgroundColor: 'var(--button-primary-bg)', color: 'var(--button-primary-text)', marginRight: '8px' },
    buttonSecondary: { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--button-secondary-border)' },
    epicListItem: { listStyle: 'none', padding: '10px', border: '1px solid var(--input-border)', borderRadius: '8px', marginBottom: '10px', backgroundColor: 'var(--card-bg)', cursor: 'pointer' },
    epicListItemSelected: { backgroundColor: 'var(--column-border-hover)' },
    error: { color: 'var(--text-error)', marginBottom: '15px', padding: '10px', border: '1px solid var(--text-error)', borderRadius: '4px' },
    loading: { textAlign: 'center', padding: '20px', color: 'var(--foreground-secondary)' },
    colorSwatchButton: { width: '80px', height: '38px', marginLeft: '8px', verticalAlign: 'middle', border: '1px solid var(--input-border)', borderRadius: '4px' },
    scrollableList: { flexGrow: 1, overflowY: 'auto', listStyle: 'none', padding: 0 },
    cardsDisplayArea: { flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' },
    dndContextContainer: { flexGrow: 1, display: 'flex', flexDirection: 'row', gap: '16px', overflowX: 'auto', overflowY: 'hidden' }
  } as const;

  const [epics, setEpics] = useState<Epic[]>([]);
  const [allColumns, setAllColumns] = useState<ColumnData[]>([]);
  const [allVersions, setAllVersions] = useState<VersionForSelect[]>([]);

  const [loadingEpics, setLoadingEpics] = useState(true);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [associatedCards, setAssociatedCards] = useState<AssociatedCard[]>([]);
  const [activeDraggedCardData, setActiveDraggedCardData] = useState<AssociatedCard | null>(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#000000');
  const [newEpicStartDate, setNewEpicStartDate] = useState('');
  const [newEpicFinishDate, setNewEpicFinishDate] = useState('');
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [finishDateError, setFinishDateError] = useState<string | null>(null);

  const validateDates = (start: string, finish: string): string | null => {
    if (start && finish) {
      const s = new Date(start), f = new Date(finish);
      if (s >= f) return 'Start date must be before finish date.';
    }
    return null;
  };

  const calculateDaysRemaining = (finishDateStr?: string | null): string => {
    if (!finishDateStr) return 'N/A';
    const finish = new Date(finishDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    finish.setHours(0,0,0,0);
    if (Number.isNaN(finish.getTime())) return 'Invalid Date';
    const diffDays = Math.ceil((finish.getTime() - today.getTime())/(1000*60*60*24));
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day(s)`;
    if (diffDays === 0) return 'Due today';
    return `${diffDays} day(s) remaining`;
  };

  const fetchInitialData = useCallback(async () => {
    if (!session || !user) {
      setError('You must be logged in to manage epics.');
      setLoadingEpics(false);
      setLoadingColumns(false);
      setLoadingVersions(false);
      return;
    }
    setError(null);
    setLoadingEpics(true);
    setLoadingColumns(true);
    setLoadingVersions(true);

    try {
      const epicsQ = supabase.from('epics').select('id, name, description, color, created_at, start_date, finish_date');
      const colsQ  = supabase.from('columns').select('id, title, order');
      const versQ  = supabase.from('versions').select('id, name');
      const [eRes, cRes, vRes] = await Promise.all([epicsQ, colsQ, versQ]);

      if (eRes.error) throw eRes.error;
      if (cRes.error) throw cRes.error;
      if (vRes.error) throw vRes.error;

      setEpics(eRes.data ?? []);
      setAllColumns(cRes.data ?? []);
      setAllVersions(vRes.data ?? []);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoadingEpics(false);
      setLoadingColumns(false);
      setLoadingVersions(false);
    }
  }, [session, user]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchCardsForEpic = useCallback(async (epicId: string) => {
    if (!session || !user) {
      setError('You must be logged in to fetch cards.');
      setLoadingCards(false);
      return;
    }
    setError(null);
    setLoadingCards(true);
    setAssociatedCards([]);

    try {
      const { data, error: cardsError } = await supabase
        .from('cards')
        .select('id, title, description, column_id, order, due_date, epic_id, version_id, is_archived, board_id')
        .eq('epic_id', epicId)
        .order('column_id')
        .order('order', { ascending: true });
      if (cardsError) throw cardsError;
      setAssociatedCards(data ?? []);
    } catch (err) {
      console.error(`Error fetching cards for epic ${epicId}:`, err);
      setError(err instanceof Error ? err.message : 'Could not fetch cards.');
    } finally {
      setLoadingCards(false);
    }
  }, [session, user]);

  const handleSelectEpic = (epicId: string) => {
    if (selectedEpicId === epicId) {
      setSelectedEpicId(null);
      setAssociatedCards([]);
    } else {
      setSelectedEpicId(epicId);
      fetchCardsForEpic(epicId);
    }
  };

  const handleCreateEpic = async () => {
    if (!newName.trim()) {
      setError('Epic name cannot be empty.');
      return;
    }
    setError(null);
    setStartDateError(null);
    setFinishDateError(null);
    const dateErr = validateDates(newEpicStartDate, newEpicFinishDate);
    if (dateErr) {
      setFinishDateError(dateErr);
      return;
    }
    try {
      const { data, error: insErr } = await supabase
        .from('epics')
        .insert({
          name: newName.trim(),
          description: newDescription.trim() || null,
          color: newColor,
          start_date: newEpicStartDate || null,
          finish_date: newEpicFinishDate || null,
          user_id: user!.id
        })
        .select()
        .single();
      if (insErr) throw insErr;
      if (data) {
        setEpics(prev =>
          [data as Epic, ...prev].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
      } else {
        fetchInitialData();
      }
      setNewName('');
      setNewDescription('');
      setNewColor('#000000');
      setNewEpicStartDate('');
      setNewEpicFinishDate('');
      await refetchFilterData();
    } catch (err) {
      console.error('Error creating epic:', err);
      setError(err instanceof Error ? err.message : 'Could not create epic.');
    }
  };

  const handleDeleteEpic = async (epicId: string) => {
    if (!window.confirm('Delete this epic?')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase.from('epics').delete().eq('id', epicId);
      if (delErr) throw delErr;
      setEpics(prev => prev.filter(e => e.id !== epicId));
      if (selectedEpicId === epicId) {
        setSelectedEpicId(null);
        setAssociatedCards([]);
      }
    } catch (err) {
      console.error(`Error deleting epic ${epicId}:`, err);
      setError(err instanceof Error ? err.message : 'Could not delete epic.');
    }
  };

  const handleCardUpdate = async (
    cardId: string,
    updates: {
      title?: string;
      description?: string | null; // Changed to allow null
      due_date?: string | null;
      project_id?: string | null; // Changed from epic_id
      ver_id?: string | null; // Changed from version_id
      is_archived?: boolean;
    }
  ) => {
    setError(null);
    try {
      const { error: updErr } = await supabase.from('cards').update(updates).eq('id', cardId);
      if (updErr) throw updErr;
      if (selectedEpicId) await fetchCardsForEpic(selectedEpicId);
    } catch (err) {
      console.error(`Error updating card ${cardId}:`, err);
      setError(err instanceof Error ? err.message : 'Could not update card.');
    }
  };

  const handleCardDelete = async (cardId: string) => {
    if (!window.confirm('Delete this card permanently?')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase.from('cards').delete().eq('id', cardId);
      if (delErr) throw delErr;
      if (selectedEpicId) await fetchCardsForEpic(selectedEpicId);
    } catch (err) {
      console.error(`Error deleting card ${cardId}:`, err);
      setError(err instanceof Error ? err.message : 'Could not delete card.');
    }
  };

  const handleCardArchive = async (cardId: string) => {
    setError(null);
    try {
      const { error: archErr } = await supabase.from('cards').update({ is_archived: true }).eq('id', cardId);
      if (archErr) throw archErr;
      if (selectedEpicId) await fetchCardsForEpic(selectedEpicId);
    } catch (err) {
      console.error(`Error archiving card ${cardId}:`, err);
      setError(err instanceof Error ? err.message : 'Could not archive card.');
    }
  };

  function handleDragStartEpicsPage(event: DragStartEvent) {
    const card = associatedCards.find(c => c.id === event.active.id);
    if (card) setActiveDraggedCardData(card);
  }

  function handleDragEndEpicsPage(event: DragEndEvent) {
    setActiveDraggedCardData(null);
    const { active, over } = event;

    // Ensure 'over' and its data are defined before proceeding
    if (!over || !over.data.current || !active.data.current || active.id === over.id) {
      return;
    }
    
    const activeId = active.id as string;
    const activeCard = associatedCards.find(c => c.id === activeId);
    if (!activeCard) return;

    const overId = over.id as string;
    // Safely access over.data.current properties
    const overData = over.data.current;
    const targetColumnId = overData.type === 'column'
      ? overId
      : overData.column_id as string;

    if (!targetColumnId) return;

    const overDataType = overData.type; // Capture type before closure
    // const finalTargetColumnId = targetColumnId; // This was the change, let's ensure targetColumnId is used directly.

    setAssociatedCards(prev => {
      const cardToMove = prev.find(c => c.id === activeId);
      if (!cardToMove) return prev;

      let newOrderInColumn: number;
      // Use targetColumnId directly as it's in scope of this callback
      const cardsInTarget = prev.filter(c => c.column_id === targetColumnId && c.id !== activeId);
      
      if (overDataType === 'card') { // Use captured type
        const overCard = prev.find(c => c.id === overId);
        newOrderInColumn = overCard ? overCard.order : cardsInTarget.length;
      } else { // It's a column
        newOrderInColumn = cardsInTarget.length;
      }

      const temp = prev.map(c =>
        c.id === activeId ? { ...c, column_id: targetColumnId, order: -1 } : c
      );

      const finalInTarget = temp
        .filter(c => c.column_id === targetColumnId)
        .sort((a, b) => a.order - b.order);

      const idx = finalInTarget.findIndex(c => c.id === activeId);
      if (idx !== -1) finalInTarget.splice(idx, 1);

      let insertAt = finalInTarget.findIndex(c => c.order >= newOrderInColumn);
      if (insertAt === -1) insertAt = finalInTarget.length;
      finalInTarget.splice(insertAt, 0, { ...cardToMove, column_id: targetColumnId, order: newOrderInColumn });

      finalInTarget.forEach((c, i) => { c.order = i; });

      const others = temp.filter(c => c.column_id !== targetColumnId);
      const newList = [...others, ...finalInTarget].sort((a, b) =>
        a.column_id.localeCompare(b.column_id) || a.order - b.order
      );

      const toDb = newList.find(c => c.id === activeId);
      if (toDb) {
        supabase
          .from('cards')
          .update({ column_id: toDb.column_id, order: toDb.order })
          .eq('id', activeId)
          .then(({ error }) => {
            if (error) {
              console.error('Error DnD update:', error);
              if (selectedEpicId) fetchCardsForEpic(selectedEpicId);
            } else {
              if (selectedEpicId) fetchCardsForEpic(selectedEpicId);
            }
          });
      }

      return newList;
    });
  }

  if (!session || !user) {
    if (loadingEpics || loadingColumns || loadingVersions) {
      return <p style={styles.loading}>Loading...</p>;
    }
    return <p style={styles.error}>{error ?? 'Please log in.'}</p>;
  }

  const selectedEpic = selectedEpicId ? epics.find(e => e.id === selectedEpicId) : null;

  return (
    <div style={styles.container}>
      <aside style={styles.epicsListPanel}>
        <h2>Epics</h2>
        {error && <p style={styles.error}>{error}</p>}
        {(loadingEpics || loadingColumns || loadingVersions) && !error && <p style={styles.loading}>Loading Data...</p>}
        <div style={styles.formSection}>
          <h3>Create New Epic</h3>
          <div style={styles.inputGroup}>
            <label htmlFor="epic-name" style={styles.label}>Name*:</label>
            <input id="epic-name" type="text" value={newName} onChange={e => setNewName(e.target.value)} style={styles.input} />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="epic-desc" style={styles.label}>Description:</label>
            <textarea id="epic-desc" value={newDescription} onChange={e => setNewDescription(e.target.value)} style={styles.input} rows={2} />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="epic-color" style={styles.label}>Color:</label>
            <input id="epic-color" type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={styles.colorSwatchButton} />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="epic-start" style={styles.label}>Start Date:</label>
            <input
              id="epic-start"
              type="date"
              value={newEpicStartDate}
              onChange={e => { setNewEpicStartDate(e.target.value); setStartDateError(null); setFinishDateError(null); }}
              style={styles.input}
            />
            {startDateError && <div style={{ position: 'relative', marginTop: '4px' }}>{startDateError}</div>}
          </div>
          <div style={{ ...styles.inputGroup, position: 'relative' }}>
            <label htmlFor="epic-finish" style={styles.label}>Finish Date:</label>
            <input
              id="epic-finish"
              type="date"
              value={newEpicFinishDate}
              onChange={e => {
                setNewEpicFinishDate(e.target.value);
                setFinishDateError(null);
                if (newEpicStartDate) {
                  const v = validateDates(newEpicStartDate, e.target.value);
                  if (v) setFinishDateError(v);
                }
              }}
              style={styles.input}
            />
            {finishDateError && <div>{finishDateError}</div>}
          </div>
          <button onClick={handleCreateEpic} style={styles.button}>+ Add Epic</button>
        </div>
        <h3>Existing Epics</h3>
        {!loadingEpics && epics.length === 0 && <p>No epics found.</p>}
        <ul style={styles.scrollableList}>
          {epics.map(epic => (
            <li
              key={epic.id}
              onClick={() => handleSelectEpic(epic.id)}
              style={{
                ...styles.epicListItem,
                ...(selectedEpicId === epic.id ? styles.epicListItemSelected : {}),
                borderLeft: `5px solid ${epic.color ?? 'transparent'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: selectedEpicId === epic.id ? 'bold' : 'normal' }}>{epic.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteEpic(epic.id); }}
                  style={{ ...styles.buttonSecondary, padding: '2px 6px', background: 'transparent', border: 0 }}
                  aria-label="Delete epic"
                >
                  🗑️
                </button>
              </div>
              {epic.description && (
                <p style={{ fontSize: '0.9em', color: 'var(--text-subtle)' }}>{epic.description}</p>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <section style={styles.cardsPanel}>
        {selectedEpic ? (
          <>
            <div style={{ marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--card-border)' }}>
              <h2>{selectedEpic.name}</h2>
              {selectedEpic.description && <p style={{ color: 'var(--text-subtle)' }}>{selectedEpic.description}</p>}
              {selectedEpic.start_date && <p>Start: {new Date(selectedEpic.start_date).toLocaleDateString()}</p>}
              {selectedEpic.finish_date && (
                <p>
                  Finish: {new Date(selectedEpic.finish_date).toLocaleDateString()} ({calculateDaysRemaining(selectedEpic.finish_date)})
                </p>
              )}
            </div>

            <div style={styles.cardsDisplayArea}>
              {loadingCards && !error && <p style={styles.loading}>Loading cards...</p>}
              {!loadingCards && (
                <DndContext onDragStart={handleDragStartEpicsPage} onDragEnd={handleDragEndEpicsPage} collisionDetection={closestCenter}>
                  {(loadingColumns || loadingVersions) && !error && <p style={styles.loading}>Loading columns...</p>}
                  {!loadingColumns && !loadingVersions && allColumns.length > 0 ? (
                    <div style={styles.dndContextContainer}>
                      {allColumns.sort((a,b) => a.order - b.order).map(col => { // Ensure columns are sorted by their order
                        const cardsInCol = associatedCards.filter(c => c.column_id === col.id).sort((a, b) => a.order - b.order);
                        return (
                          <DroppableEpicColumn
                            key={col.id}
                            column={col}
                            cardsInColumn={cardsInCol}
                            allProjects={epics}
                            allVersions={allVersions}
                            onUpdateCard={handleCardUpdate}
                            onDeleteCard={handleCardDelete}
                            onArchiveCard={handleCardArchive}
                            styles={styles} // Pass styles
                          />
                        );
                      })}
                    </div>
                  ) : (
                    !error && <p>No columns defined to display cards.</p>
                  )}

                  <DragOverlay dropAnimation={null}>
                    {activeDraggedCardData && (
                      <KanbanTask
                        id={activeDraggedCardData.id}
                        title={activeDraggedCardData.title}
                        description={activeDraggedCardData.description ?? undefined}
                        stage_id={activeDraggedCardData.column_id}
                        order={activeDraggedCardData.order}
                        due_date={activeDraggedCardData.due_date ?? undefined}
                        project_id={activeDraggedCardData.epic_id ?? undefined}
                        ver_id={activeDraggedCardData.version_id ?? undefined}
                        is_archived={activeDraggedCardData.is_archived ?? false}
                        allProjects={epics}
                        allVers={allVersions}
                        onUpdateTask={handleCardUpdate}
                        onDeleteTask={handleCardDelete}
                        onArchiveTask={handleCardArchive}
                        workspaceId={activeDraggedCardData.board_id}
                        isReadOnly
                      />
                    )}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--foreground-secondary)', paddingTop: '50px' }}>
            <p>Select an Epic from the list to view its cards.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default EpicsManager;
