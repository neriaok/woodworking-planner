import { useState, type FC } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePersistence } from '../../hooks/usePersistence';
import { selectSelectedNode } from '../../features/scene/sceneSelectors';
import TopBar from '../TopBar';
import Viewport from '../Viewport';
import ViewSwitcher from '../ViewSwitcher';
import SceneSummary from '../SceneSummary';
import SelectionPanel from '../SelectionPanel';
import BottomToolbar from '../BottomToolbar';
import AddPartSheet from '../AddPartSheet';
import PhotoPartFlow from '../PhotoPartFlow';
import PickBanner from '../PickBanner';
import StageControls from '../StageControls';
import styles from './App.module.css';

const App: FC = () => {
  useKeyboardShortcuts();
  usePersistence();
  const selected = useAppSelector(selectSelectedNode);
  const pickMode = useAppSelector((s) => s.editor.pickMode);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const handlePhoto = (file: File): void => {
    setIsAddOpen(false);
    setPhotoFile(file);
  };

  return (
    <div className={styles.app} dir="rtl">
      <TopBar />
      <main className={styles.stage}>
        <Viewport />
        <ViewSwitcher />
        <SceneSummary />
        <StageControls />
        <button
          type="button"
          className={styles.addButton}
          onClick={() => setIsAddOpen(true)}
          aria-label="הוסף חלק"
        >
          <IconPlus size={26} stroke={2} />
        </button>
      </main>
      <div className={styles.bottom}>
        {pickMode ? <PickBanner /> : selected && <SelectionPanel node={selected} />}
        <BottomToolbar />
      </div>
      {isAddOpen && <AddPartSheet onClose={() => setIsAddOpen(false)} onPhoto={handlePhoto} />}
      {photoFile && <PhotoPartFlow initialFile={photoFile} onClose={() => setPhotoFile(null)} />}
    </div>
  );
};

export default App;
