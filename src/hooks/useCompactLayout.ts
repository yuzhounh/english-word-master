import { useEffect, useState } from 'react';
import { isAndroidApp } from '../lib/nativeLayout';

export function useCompactLayout() {
  const [compact, setCompact] = useState(() => isAndroidApp || window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    if (isAndroidApp) return;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}
