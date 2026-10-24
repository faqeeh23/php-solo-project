import { useId, useRef } from "react";
export default function ConfirmButton({ onConfirm, children, disabled, confirmation, ...props }) {
  const dialog = useRef(null);
  const id = useId();
  return <>
    <button {...props} type="button" disabled={disabled} onClick={() => dialog.current.showModal()}>{children}</button>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby={id}>
      <span className="eyebrow">Please confirm</span>
      <h2 id={id}>{confirmation}</h2>
      <p>{confirmation.startsWith("Remove") ? "This available time will no longer be offered to patients." : "This booking will be cancelled and its time made available again."}</p>
      <div className="confirm-actions">
        <button type="button" className="keep-button" onClick={() => dialog.current.close()}>Keep it</button>
        <button type="button" className="confirm-danger" onClick={() => { dialog.current.close(); onConfirm(); }}>Yes, {confirmation.startsWith("Remove") ? "remove slot" : "cancel appointment"}</button>
      </div>
    </dialog>
  </>;
}
