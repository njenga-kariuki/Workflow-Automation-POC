import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Play } from "lucide-react";

export const HeroSection = () => {
  const [, setLocation] = useLocation();
  
  const handleGetStarted = () => {
    setLocation("/instructions");
  };
  
  return (
    <div className="py-12">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
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
        <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
          <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
            <div className="relative block w-full bg-white rounded-lg overflow-hidden">
              <img 
                className="w-full" 
                src="https://images.unsplash.com/photo-1551836022-deb4988cc6c0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" 
                alt="Workflow automation" 
              />
              <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                <button className="flex items-center justify-center h-16 w-16 rounded-full bg-white bg-opacity-75 text-primary hover:bg-opacity-100 focus:outline-none">
                  <Play className="h-8 w-8 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
