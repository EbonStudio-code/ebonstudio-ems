import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck2, ListTodo, Users } from 'lucide-react';
import Brand from './Brand';

export default function AuthStory({ preview = false }: { preview?: boolean }) {
  return <section className="auth-story" aria-label="Ebon Studio">
    <Link className="brand" to="/login" aria-label="Ebon Studio sign in"><Brand reversed /></Link>
    <div className="auth-story-content">
      <span className="eyebrow">THE EBON STUDIO WORKSPACE</span>
      <h2><span className="story-line">Good people.</span><span className="story-line story-gold">Great things.</span></h2>
      <p>One connected space for the people behind the work. Less routine. More room to create.</p>
      <div className="auth-scene" aria-label="People, time and work in one workspace">
        <div className="scene-card scene-people"><div className="scene-card-top"><Users size={20} aria-hidden="true" /><span>01 / PEOPLE</span><ArrowUpRight size={16} aria-hidden="true" /></div><strong>A team. Not just a list.</strong><span>One place to stay connected.</span><div className="scene-people-motif" aria-hidden="true"><i /><i /><i /><i /><span /></div></div>
        <div className="scene-card"><div className="scene-card-top"><CalendarCheck2 size={19} aria-hidden="true" /><span>02 / TIME</span></div><strong>Make every day count.</strong><span>Attendance &amp; time off.</span></div>
        <div className="scene-card"><div className="scene-card-top"><ListTodo size={19} aria-hidden="true" /><span>03 / WORK</span></div><strong>Keep things moving.</strong><span>A clear view of what’s next.</span></div>
      </div>
    </div>
    <div className="auth-story-footer"><span className="studio-signature">EBON STUDIO <span aria-hidden="true">/</span> EMS</span>
      <small>{preview ? 'Fictional demo · not real employee records' : 'Internal workspace · invited team members only'}</small></div>
    <img className="auth-watermark" src="/brand/ebon-studio-icon-reversed.svg" alt="" aria-hidden="true" width={512} height={512} />
  </section>;
}
