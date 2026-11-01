export default function Brand({ reversed = false }: { reversed?: boolean }) {
  return <img className="brand-logo" src={`/brand/ebon-studio-logo${reversed ? '-reversed' : ''}.svg`}
    alt="Ebon Studio" width={477} height={166} />;
}
