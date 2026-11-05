import { Fragment } from 'react';
import type { ReactNode } from 'react';

export interface DashboardSection {
  id: string;
  content: ReactNode;
  priority?: number;
  quiet?: boolean;
}

export default function DashboardSections({ sections }: { sections: DashboardSection[] }) {
  // Order the DOM as well as the visuals so keyboard and reading order agree.
  const active = sections.filter(section => !section.quiet)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const quiet = sections.filter(section => section.quiet);
  return <>
    {active.length > 0 && <div className="dashboard-panels">{active.map(section =>
      <Fragment key={section.id}>{section.content}</Fragment>)}</div>}
    {quiet.length > 0 && <section className="dashboard-quiet" aria-label="More from your workspace">
      {quiet.map(section => <Fragment key={section.id}>{section.content}</Fragment>)}
    </section>}
  </>;
}
