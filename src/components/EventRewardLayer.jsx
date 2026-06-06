import EventRewardModal from './EventRewardModal.jsx';
import { useEventRewardModal } from '../hooks/useEventRewardModal.js';

/**
 * @param {{ authUid?: string }} props
 */
export default function EventRewardLayer({ authUid }) {
  const { open, reward, close } = useEventRewardModal(authUid);

  return (
    <EventRewardModal
      open={open}
      onClose={close}
      title={reward?.title}
      message={reward?.message}
      imageSrc={reward?.imageSrc}
      imageAlt={reward?.imageAlt}
    />
  );
}
