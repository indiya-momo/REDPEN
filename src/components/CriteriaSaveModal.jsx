import AppDialog from './AppDialog.jsx';

/**
 * 프로젝트(기준) 저장 완료 안내
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   projectName: string,
 * }} props
 */
export default function CriteriaSaveModal({ open, onClose, projectName }) {
  const label = (projectName || '프로젝트').trim() || '프로젝트';

  return (
    <AppDialog
      open={open}
      title="저장 완료"
      message={`「${label}」 프로젝트가 저장되었습니다.`}
      mode="alert"
      onConfirm={onClose}
      onClose={onClose}
    />
  );
}
