import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "@/pages/landing";
import InstructionsPage from "@/pages/instructions";
import UploadPage from "@/pages/upload";
import ProcessingPage from "@/pages/processing";
import WorkflowPage from "@/pages/workflow";
import NotFound from "@/pages/not-found";
import { Navbar } from "@/components/common/Navbar";

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/instructions" component={InstructionsPage} />
          <Route path="/upload" component={UploadPage} />
          <Route path="/processing/:id" component={ProcessingPage} />
          <Route path="/workflow/:id" component={WorkflowPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

export default App;
