import { useCallback, useMemo, useState } from 'react';
import '../../components/my-page.css';
import '../../components/project-hub-settings.css';
import './mypage-prototype.css';
import ProjectHubEditorPage from '../../components/projectHub/ProjectHubEditorPage.jsx';
import { useMockProjectHubLibrary } from './useMockProjectHubLibrary.js';
import WorkbenchBarMock from './WorkbenchBarMock.jsx';

/** @typedef {'library' | 'workbench'} ProtoView */

export default function MyPagePrototypeScreen() {
  const library = useMockProjectHubLibrary();
  const [view, setView] = useState(/** @type {ProtoView} */ ('library'));

  const workbenchCard = useMemo(
    () =>
      library.previewCards.find((card) => card.id === library.activeSetId) ??
      library.previewCards[0] ??
      null,
    [library.previewCards, library.activeSetId],
  );

  const handleStartWork = useCallback(
    async (cardId) => {
      const result = await library.selectProject(cardId);
      if (!result.ok) return;
      setView('workbench');
    },
    [library],
  );

  if (view === 'workbench' && workbenchCard) {
    return (
      <div className="mypage-proto">
        <WorkbenchBarMock
          card={workbenchCard}
          onBackToLibrary={() => setView('library')}
        />
      </div>
    );
  }

  return (
    <div className="mypage mypage-proto">
      <main className="mypage__main mypage-proto__main mypage-proto__main--editor">
        <div className="mypage__main-inner mypage__main-inner--section mypage__overview--projects">
          <ProjectHubEditorPage
            uid=""
            email=""
            library={library}
            onStartWork={handleStartWork}
          />
        </div>
      </main>
    </div>
  );
}
