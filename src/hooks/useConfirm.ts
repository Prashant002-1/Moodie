import { createContext, useContext } from 'react';

export interface Question {
  /** What is about to happen, as a question: "Delete this viewing?" */
  title: string;
  /** What goes with it, and what stays. */
  body?: string;
  /** The word on the button that goes ahead: "Delete". */
  action: string;
}
export type Ask = (question: Question) => Promise<boolean>;

// Outside the provider (a component rendered alone) the browser's own prompt answers.
export const ConfirmContext = createContext<Ask>(async question => window.confirm([question.title, question.body].filter(Boolean).join(' ')));

/** Ask before something that cannot be taken back: `if (!(await confirm({ … }))) return;` */
export const useConfirm = () => useContext(ConfirmContext);
