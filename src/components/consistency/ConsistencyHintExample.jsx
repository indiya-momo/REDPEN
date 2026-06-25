/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function ConsistencyHintExample({ children }) {
  return (
    <span className="consistency-hint-example">
      <span className="consistency-hint-badge">예</span>
      <span className="consistency-hint-example-body">{children}</span>
    </span>
  );
}
