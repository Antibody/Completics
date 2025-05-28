// app/calendar/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventInput, EventChangeArg } from '@fullcalendar/core';
import supabase from '../../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const CalendarPage: React.FC = () => {
  const { session, user } = useAuth();
  const [events, setEvents] = useState<EventInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!session || !user) {
      setLoading(false);
      setError("You must be logged in to view the calendar.");
      return;
    }

    const fetchCalendarData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch user's workspaces
        const { data: workspacesData, error: workspacesError } = await supabase
          .from('workspaces')
          .select('id')
          .eq('user_id', user.id);

        if (workspacesError) throw workspacesError;
        if (!workspacesData || workspacesData.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const userWorkspaceIds = workspacesData.map(workspace => workspace.id);

        // 2. Fetch tasks from those workspaces
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, due_date, is_archived, workspace_id')
          .in('workspace_id', userWorkspaceIds)
          .not('due_date', 'is', null);

        if (tasksError) throw tasksError;
        
        setEvents(
          (tasksData || []).map((task) => ({ // Removed explicit type here, relying on inference or TaskData
            id: task.id,
            title: task.title,
            date: task.due_date,
            backgroundColor: task.is_archived ? 'var(--calendar-archived-bg, #a0aec0)' : 'var(--calendar-event-bg, #3182ce)',
            borderColor: task.is_archived ? 'var(--calendar-archived-border, #718096)' : 'var(--calendar-event-border, #2c5282)',
            extendedProps: {
              is_archived: task.is_archived
            }
          }))
        );
      } catch (err) {
        console.error("Error fetching calendar data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [session, user]);

  const handleEventDrop = async (changeInfo: EventChangeArg) => {
    const { event } = changeInfo;
    const newDate = event.startStr;
    const taskId = event.id;
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ due_date: newDate })
      .eq('id', taskId);
    if (updateError) {
      console.error("Error updating event date:", updateError);
      setError(updateError.message);
    }
  };

  if (loading) {
    return <p style={{ padding: 16, textAlign: 'center' }}>Loading calendar...</p>;
  }
  
  if (!session || !user) {
    return <p style={{ padding: 16, textAlign: 'center' }}>{error || "Please log in to view the calendar."}</p>;
  }
  
  if (error && !loading) {
    return <p style={{ padding: 16, color: 'red', textAlign: 'center' }}>Error: {error}</p>;
  }

  return (
    <div style={{ padding: 16 }}>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        editable={true}
        eventDrop={handleEventDrop}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        height="auto"
      />
    </div>
  );
};

export default CalendarPage;
