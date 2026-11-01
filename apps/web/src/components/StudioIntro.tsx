import type { ReactNode } from 'react';
import { usePageTitle } from '../core/usePageTitle';

export default function StudioIntro({ title, description, actions, meta }: {
  title: string; description?: string; actions?: ReactNode; meta?: ReactNode;
}) {
  usePageTitle(title);
  return <header className="studio-intro">
    <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}
      {meta && <div className="studio-intro-meta">{meta}</div>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  </header>;
}
