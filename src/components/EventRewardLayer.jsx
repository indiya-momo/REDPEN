import EventRewardModal from './EventRewardModal.jsx';
import { useEventRewardModal } from '../hooks/useEventRewardModal.js';

/**
 * @param {{ authUid?: string, checkTick?: number }} props
 */
export default function EventRewardLayer({ authUid, checkTick = 0 }) {
  const { open, reward, close } = useEventRewardModal(authUid, checkTick);

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
