import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes } from "react";
import { Check, Minus } from "lucide-react";

/** Native semantics and keyboard behavior, with a shared Taha visual control. */
export const AppCheckbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {indeterminate?:boolean}
>(function AppCheckbox({ className = "", indeterminate=false, ...props }, ref) {
  const input=useRef<HTMLInputElement>(null);
  useImperativeHandle(ref,()=>input.current!);
  useEffect(()=>{if(input.current)input.current.indeterminate=indeterminate;},[indeterminate,props.checked]);
  return (
    <span className={`app-checkbox ${className}`}>
      <input {...props} type="checkbox" ref={input} aria-checked={indeterminate?'mixed':props['aria-checked']} />
      <span className="app-checkbox-mark" aria-hidden="true">
        {indeterminate?<Minus size={14} strokeWidth={3}/>:<Check size={14} strokeWidth={3} />}
      </span>
    </span>
  );
});
