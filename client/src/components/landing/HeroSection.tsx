import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export const HeroSection = () => {
  const [, setLocation] = useLocation();
  
  const handleGetStarted = () => {
    setLocation("/instructions");
  };
  
  return (
    <div className="py-16 text-center"> 
      <div className="max-w-3xl mx-auto">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Show us once,</span>
            <span className="block text-primary">never do it again</span>
          </h1>
          <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg">
            Data Jaw eliminates the frustration of repeatedly rebuilding information workflows. We automate your recurring tasks by observing a single demonstration.
          </p>
          <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg">
            Save 4-6 hours weekly by automating tasks like data updates, formatting, and report generation.
          </p>
          <div className="mt-8 sm:mt-12">
            <Button onClick={handleGetStarted} size="lg">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
