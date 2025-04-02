import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ProcessingStatus } from "@/components/processing/ProcessingStatus";

export default function ProcessingPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!id) {
      setLocation("/upload");
    }
  }, [id]);
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {id && <ProcessingStatus workflowId={parseInt(id)} />}
    </div>
  );
}
