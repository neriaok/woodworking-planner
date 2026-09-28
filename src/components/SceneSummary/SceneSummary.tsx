import type { FC } from 'react';
import clsx from 'clsx';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { selectCollidingIds, selectSceneBounds } from '../../features/scene/sceneSelectors';
import { formatCm } from '../../lib/units';
import styles from './SceneSummary.module.css';

/** Overall size of the whole build, plus a collision warning. */
const SceneSummary: FC = () => {
  const bounds = useAppSelector(selectSceneBounds);
  const collisions = useAppSelector(selectCollidingIds);
  if (!bounds) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.chip}>
        <span className={styles.caption}>סה״כ</span>
        <span>
          ר {formatCm(bounds.size.x)} · ג {formatCm(bounds.size.y)} · ע {formatCm(bounds.size.z)} ס״מ
        </span>
      </div>
      {collisions.size > 0 && (
        <div className={clsx(styles.chip, styles.warning)}>
          <IconAlertTriangle size={16} />
          <span>חלקים חופפים</span>
        </div>
      )}
    </div>
  );
};

export default SceneSummary;
