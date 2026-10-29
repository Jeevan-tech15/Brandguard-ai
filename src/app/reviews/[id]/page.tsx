import { Suspense } from 'react';
import { ReviewDetailsView } from '@/components/reviews/ReviewDetailsView';

async function ReviewDetailsContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewDetailsView id={id} />;
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Loading review audit record...</p>
        </div>
      }
    >
      <ReviewDetailsContent params={params} />
    </Suspense>
  );
}
