import { useState, type FC } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { selectSelectedNode } from '../../features/scene/sceneSelectors';
import TopBar from '../TopBar';
import Viewport from '../Viewport';
import ViewSwitcher from '../ViewSwitcher';
import SceneSummary from '../SceneSummary';
import SelectionPanel from '../SelectionPanel';
import BottomToolbar from '../BottomToolbar';
import AddPartSheet from '../AddPartSheet';
import styles from './App.module.css';

const App: FC = () => {
  useKeyboardShortcuts();
  const selected = useAppSelector(selectSelectedNode);
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className={styles.app} dir="rtl">
      <TopBar />
      <main className={styles.stage}>
        <Viewport />
        <ViewSwitcher />
        <SceneSummary />
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
        {selected && <SelectionPanel node={selected} />}
        <BottomToolbar />
      </div>
      {isAddOpen && <AddPartSheet onClose={() => setIsAddOpen(false)} />}
    </div>
  );
};

export default App;
