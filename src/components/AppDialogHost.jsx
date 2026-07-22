import { useLayoutEffect, useRef, useState } from 'react';
import AppDialog from './AppDialog.jsx';
import {
  registerAppDialogHost,
  unregisterAppDialogHost,
} from '../lib/appDialog.js';

/**
 * @typedef {import('react').ReactNode} ReactNode */

/**
 * @typedef {{
 *   mode: 'alert' | 'confirm',
 *   title?: string,
 *   message?: string,
 *   messageNode?: ReactNode,
 *   copyableUrl?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   showGuideHand?: boolean,
 * }} DialogState
 */

export default function AppDialogHost() {
  const [state, setState] = useState(/** @type {DialogState | null} */ (null));
  const resolverRef = useRef(/** @type {{ resolve: (v: boolean | void) => void } | null} */ (null));
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  const apiRef = useRef({
    alert: (opts) =>
      new Promise((resolve) => {
        resolverRef.current = { resolve: () => resolve() };
        setStateRef.current({
          mode: 'alert',
          title: opts.title || '안내',
          message: opts.message ?? '',
          messageNode: opts.messageNode,
          copyableUrl: opts.copyableUrl,
          confirmLabel: opts.confirmLabel || '확인',
          showGuideHand: Boolean(opts.showGuideHand),
        });
      }),
    confirm: (opts) =>
      new Promise((resolve) => {
        resolverRef.current = { resolve };
        setStateRef.current({
          mode: 'confirm',
          title: opts.title || '안내',
          message: opts.message,
          confirmLabel: opts.confirmLabel || '확인',
          cancelLabel: opts.cancelLabel || '취소',
        });
      }),
  });

  useLayoutEffect(() => {
    const api = apiRef.current;
    registerAppDialogHost(api);
    return () => {
      unregisterAppDialogHost(api);
    };
  }, []);

  if (!state) return null;

  const finish = (result) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolver?.resolve(result);
  };

  return (
    <AppDialog
      open
      mode={state.mode}
      title={state.title || '안내'}
      message={state.message}
      messageNode={state.messageNode}
      copyableUrl={state.copyableUrl}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      showGuideHand={Boolean(state.showGuideHand)}
      onConfirm={() => finish(state.mode === 'confirm')}
      onCancel={() => finish(false)}
    />
  );
}
