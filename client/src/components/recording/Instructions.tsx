import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Info, 
  ChevronLeft
} from "lucide-react";

export const Instructions = () => {
  const [, setLocation] = useLocation();
  
  const handleUploadClick = () => {
    setLocation("/upload");
  };
  
  const handleBackClick = () => {
    setLocation("/");
  };
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900">Record Your Workflow</h1>
        <p className="mt-2 text-lg text-gray-600">Follow these steps to create an effective workflow recording</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm px-6 py-8 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recording Instructions</h2>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                1
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Open QuickTime Player</h3>
              <p className="mt-1 text-gray-500">On your Mac, open QuickTime Player from your Applications folder or Spotlight.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                2
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Select "New Screen Recording"</h3>
              <p className="mt-1 text-gray-500">From the File menu, select "New Screen Recording" or press Control+Command+N.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                3
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Select Microphone</h3>
              <p className="mt-1 text-gray-500">Click the dropdown arrow next to the record button and select your microphone.</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                4
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Record Relevant Applications Only</h3>
              <p className="mt-1 text-gray-500">Choose to record only the window or region containing your workflow applications.</p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                5
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Narrate Your Actions</h3>
              <p className="mt-1 text-gray-500">Speak clearly to explain what you're doing as you perform each step of your workflow.</p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                6
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Keep It Under 5 Minutes</h3>
              <p className="mt-1 text-gray-500">For optimal processing, keep your recording under 5 minutes in length.</p>
            </div>
          </div>

          {/* Step 7 */}
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-primary">
                7
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Save Your Recording</h3>
              <p className="mt-1 text-gray-500">When finished, click the stop button in the menu bar and save your recording as a .mov file.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg px-6 py-5 mb-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Tips for a Good Recording</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Prepare your workflow before starting the recording</li>
                <li>Explain your reasoning for each step as you perform it</li>
                <li>Mention any conditions or variations in your workflow</li>
                <li>Speak clearly and at a moderate pace</li>
                <li>Close unnecessary applications to reduce distractions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Button onClick={handleUploadClick} size="lg">
          Upload Your Recording
        </Button>
        <p className="mt-3 text-sm text-gray-500">
          Or go back to{" "}
          <button
            onClick={handleBackClick}
            className="text-primary hover:text-blue-600"
          >
            home
          </button>
        </p>
      </div>
    </div>
  );
};
