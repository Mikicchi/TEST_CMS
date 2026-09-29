import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Header onSidebarToggle={toggleSidebar} />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="p-4">{children}</div>
        </main>
      </div>
    </div>
  );
}