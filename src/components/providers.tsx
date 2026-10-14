import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/redux/store';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ReduxProvider>
  );
}
