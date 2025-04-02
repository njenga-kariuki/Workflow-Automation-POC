import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export const Navbar = () => {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Logo />
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:flex items-center">
            <Link href="/">
              <a className={`px-3 py-2 text-sm font-medium ${location === '/' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                Home
              </a>
            </Link>
            <Link href="/instructions">
              <a className={`px-3 py-2 text-sm font-medium ${location === '/instructions' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                Record
              </a>
            </Link>
            <Button asChild className="ml-6">
              <Link href="/instructions">
                <a>Get Started</a>
              </Link>
            </Button>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
              onClick={toggleMobileMenu}
            >
              <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link href="/">
              <a className={`block px-3 py-2 text-base font-medium ${location === '/' ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                Home
              </a>
            </Link>
            <Link href="/instructions">
              <a className={`block px-3 py-2 text-base font-medium ${location === '/instructions' ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                Record
              </a>
            </Link>
            <div className="px-3 py-2">
              <Button asChild className="w-full">
                <Link href="/instructions">
                  <a>Get Started</a>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
