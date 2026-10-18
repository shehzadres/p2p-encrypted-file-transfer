import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div
      className="flex-1 flex items-center justify-center px-4 py-16"
      role="main"
      aria-label="Page not found"
    >
      <div className="glass-bright rounded-[32px] text-center max-w-md w-full px-8 py-12 animate-slide-up">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div aria-hidden className="absolute inset-0 rounded-3xl bg-accent/40 blur-xl opacity-70" />
          <div className="glass-raised relative w-20 h-20 rounded-3xl flex items-center justify-center animate-float">
            <Compass size={34} className="text-accent-light" aria-hidden />
          </div>
        </div>
        <p className="text-7xl font-semibold text-aurora font-mono mb-4 tabular tracking-tighter">404</p>
        <h1 className="text-xl font-semibold text-bright mb-2 tracking-tight">Page not found</h1>
        <p className="text-muted text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Button size="lg" onClick={() => navigate('/')}>
          <ArrowLeft size={15} aria-hidden />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
