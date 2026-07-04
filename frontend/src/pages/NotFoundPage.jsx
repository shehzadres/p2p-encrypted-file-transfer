import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div
      className="flex-1 flex items-center justify-center px-4"
      role="main"
      aria-label="Page not found"
    >
      <div className="text-center max-w-sm animate-slide-up">
        <div className="w-20 h-20 rounded-3xl bg-border/60 border border-border
                        flex items-center justify-center mx-auto mb-6">
          <Compass size={36} className="text-muted" aria-hidden />
        </div>
        <p className="text-7xl font-bold text-border/80 font-mono mb-4 tabular">404</p>
        <h1 className="text-xl font-bold text-bright mb-2 tracking-tight">Page not found</h1>
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
