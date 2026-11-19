import { useLayoutEffect, useRef, useState } from 'react';
import AppDialog from './AppDialog.jsx';
import {
  registerAppDialogHost,
  unregisterAppDialogHost,
} from '../lib/appDialog.js';

/**
 * @typedef {import('react').ReactNode} ReactNode
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   description?: string,
 *   note?: string,
 * }} ChoiceOption
 */

/**
 * @typedef {{
 *   mode: 'alert' | 'confirm' | 'choice',
 *   title?: string,
 *   message?: string,
 *   messageNode?: ReactNode,
 *   copyableUrl?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   showGuideHand?: boolean,
 *   titleAlign?: 'start' | 'center',
 *   options?: ChoiceOption[],
 * }} DialogState
 */

export default function AppDialogHost() {
  const [state, setState] = useState(/** @type {DialogState | null} */ (null));
  const resolverRef = useRef(
    /** @type {{ resolve: (v: boolean | void | string | null) => void } | null} */ (
      null
    ),
  );
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
          titleAlign: opts.titleAlign === 'start' ? 'start' : 'center',
        });
      }),
    confirm: (opts) =>
      new Promise((resolve) => {
        resolverRef.current = { resolve };
        setStateRef.current({
          mode: 'confirm',
          title: opts.title || '안내',
          message: opts.message,
          messageNode: opts.messageNode,
          confirmLabel: opts.confirmLabel || '확인',
          cancelLabel: opts.cancelLabel || '취소',
          showGuideHand: Boolean(opts.showGuideHand),
          titleAlign: opts.titleAlign === 'start' ? 'start' : 'center',
        });
      }),
    choice: (opts) =>
      new Promise((resolve) => {
        resolverRef.current = { resolve };
        setStateRef.current({
          mode: 'choice',
          title: opts.title || '선택',
          message: opts.message ?? '',
          messageNode: opts.messageNode,
          options: Array.isArray(opts.options) ? opts.options : [],
          titleAlign: opts.titleAlign === 'start' ? 'start' : 'center',
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
    // confirm→alert 연속 호출 시 setState(null)이 alert를 덮지 않도록
    // 닫힘을 커밋한 뒤 resolve (같은 틱 배칭 레이스 방지)
    queueMicrotask(() => {
      resolver?.resolve(result);
    });
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
      options={state.options}
      showGuideHand={Boolean(state.showGuideHand)}
      titleAlign={state.titleAlign === 'start' ? 'start' : 'center'}
      onConfirm={() => finish(state.mode === 'confirm')}
      onCancel={() => finish(state.mode === 'choice' ? null : false)}
      onChoice={(id) => finish(id)}
    />
  );
}
