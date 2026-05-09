import { useEffect } from "react";
import { useStore } from "./store";
import { initApp } from "./api";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Providers from "./pages/Providers";
import ModelMap from "./pages/ModelMap";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

export default function App() {
  const { page, toast } = useStore();

  useEffect(() => { initApp(); }, []);

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    providers: <Providers />,
    mappings: <ModelMap />,
    logs: <Logs />,
    settings: <Settings />,
  };

  return (
    <Layout>
      {pages[page] || <Dashboard />}
      {toast && (
        <div className="fixed bottom-6 right-6 px-5 py-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white shadow-2xl z-50 transition-all">
          {toast}
        </div>
      )}
    </Layout>
  );
}
