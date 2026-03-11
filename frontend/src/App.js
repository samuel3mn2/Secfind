import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Vulnerabilidades from "@/pages/Vulnerabilidades";
import Layout from "@/components/Layout";

function App() {
  return (
    <div className="min-h-screen bg-[#09090b]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="vulnerabilidades" element={<Vulnerabilidades />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
