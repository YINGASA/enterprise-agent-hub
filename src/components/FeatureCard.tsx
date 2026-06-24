import type { Feature } from "@/types";

export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-ink-900">{feature.title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-500">{feature.description}</p>
    </article>
  );
}
