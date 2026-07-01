/**
 * @param {{
 *   options: ReadonlyArray<{ id: string, label: string }>,
 *   value: string | null,
 *   onChange: (id: string) => void,
 * }} props
 */
export default function ProjectHubTagFilters({ options, value, onChange }) {
  if (options.length <= 1) {
    return null;
  }

  return (
    <div
      className="mypage-proto__filters"
      role="group"
      aria-label="태그 필터"
    >
      {options.map(({ id, label }) => (
        <button
          key={label}
          type="button"
          className={`mypage-proto__filter${value === id ? ' mypage-proto__filter--on' : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
