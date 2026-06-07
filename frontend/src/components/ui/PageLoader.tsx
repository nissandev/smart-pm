import { Spinner } from '@/components/shared';

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Spinner />
    </div>
  );
}
