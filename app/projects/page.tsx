// app/projects/page.tsx
import React from 'react';
import ProjectsManager from '../components/ProjectsManager';

export default function ProjectsPage() {
  return (
    <main style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      <ProjectsManager />
    </main>
  );
}
