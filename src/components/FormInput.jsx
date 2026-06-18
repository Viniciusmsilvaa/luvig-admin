export default function FormInput({ label, as = 'input', options = [], className = '', ...props }) {
  const sharedClass = `input-base ${as === 'textarea' ? 'min-h-32 resize-none py-3' : ''} ${className}`;

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {as === 'select' ? (
        <select className={sharedClass} {...props}>
          {options.map((option) => {
            const value = typeof option === 'object' ? option.value : option;
            const label = typeof option === 'object' ? option.label : option;
            return (
            <option key={value} value={value}>
              {label}
            </option>
            );
          })}
        </select>
      ) : as === 'textarea' ? (
        <textarea className={sharedClass} {...props} />
      ) : (
        <input className={sharedClass} {...props} />
      )}
    </label>
  );
}
