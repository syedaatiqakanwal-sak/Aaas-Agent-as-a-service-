import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AgentsProvider } from "@/components/agents-context";
import { ApiKeyScreen } from "@/components/api-key-screen";
import { AppShell } from "@/components/app-shell";
import { clearApiKey, getStoredApiKey } from "@/lib/api";
import { ChatPage } from "@/pages/chat-page";
import { DashboardPage } from "@/pages/dashboard-page";

export default function App() {
  const [apiKey, setApiKey] = useState(getStoredApiKey);

  if (!apiKey) {
    return <ApiKeyScreen onSaved={setApiKey} />;
  }

  return (
    <BrowserRouter>
      <AgentsProvider>
        <AppShell
          onSignOut={() => {
            clearApiKey();
            setApiKey("");
          }}
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agents/:slug" element={<ChatPage />} />
          </Routes>
        </AppShell>
      </AgentsProvider>
    </BrowserRouter>
  );
}
