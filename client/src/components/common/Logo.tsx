import { CheckCircle } from "lucide-react";
import { Link } from "wouter";

interface LogoProps {
  withText?: boolean;
  className?: string;
}

export const Logo = ({ withText = true, className = "" }: LogoProps) => {
  return (
    <Link href="/">
      <a className={`flex items-center ${className}`}>
        <CheckCircle className="h-8 w-8 text-primary" />
        {withText && (
          <span className="ml-2 text-lg font-semibold text-gray-900">Data Jaw</span>
        )}
      </a>
    </Link>
  );
};
