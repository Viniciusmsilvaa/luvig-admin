import officialLogo from '../assets/luvig-logo-oficial.png';

export default function LogoMark({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-10 w-20',
    md: 'h-14 w-28',
    lg: 'h-28 w-64',
  };

  return (
    <div className={`${sizes[size]} inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`} aria-label="Logo oficial LUVIG">
      <img
        src={officialLogo}
        alt="LUVIG Serviços Especializados"
        className="h-full w-full object-contain drop-shadow-sm"
        draggable="false"
      />
    </div>
  );
}
