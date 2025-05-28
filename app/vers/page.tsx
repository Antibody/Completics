// app/vers/page.tsx
'use client';

import React from 'react';
import VersionsManager from '../components/VersionsManager';
import { useAuth } from '../contexts/AuthContext';

const VersionsPage: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500 dark:text-gray-400">
        Loading authentication...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500 dark:text-gray-400">
        Please log in to view your versions.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Your Versions
      </h1>
      <VersionsManager />
    </div>
  );
};

export default VersionsPage;
