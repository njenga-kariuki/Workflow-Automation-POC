import { VideoIcon, LightbulbIcon, RefreshCwIcon } from "lucide-react";

export const HowItWorks = () => {
  return (
    <div className="mt-16">
      <h2 className="text-2xl font-bold text-gray-900 text-center">How it works</h2>
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Step 1 */}
        <div className="bg-white rounded-lg shadow-sm px-6 py-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-100 text-primary mb-4">
            <VideoIcon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Record</h3>
          <p className="mt-2 text-base text-gray-500">
            Show us your workflow once through a simple screen recording with audio narration.
          </p>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-lg shadow-sm px-6 py-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-100 text-secondary mb-4">
            <LightbulbIcon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Process</h3>
          <p className="mt-2 text-base text-gray-500">
            Our AI analyzes your demonstration to understand your workflow and data connections.
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-lg shadow-sm px-6 py-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-violet-100 text-accent mb-4">
            <RefreshCwIcon className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Automate</h3>
          <p className="mt-2 text-base text-gray-500">
            We create an automated workflow that runs whenever you need it, maintaining all your preferences.
          </p>
        </div>
      </div>
    </div>
  );
};
