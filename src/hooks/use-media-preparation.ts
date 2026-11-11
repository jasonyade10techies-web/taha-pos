import { useEffect, useRef, useState } from "react";

/** Keep a form open until every selected image has a usable preview. */
export function useMediaPreparation() {
  const ref = useRef<HTMLFormElement>(null);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const update = () => setPreparing(!!form.querySelector('.media-uploader[aria-busy="true"]'));
    const observer = new MutationObserver(update);
    observer.observe(form, {subtree:true,childList:true,attributes:true,attributeFilter:["aria-busy"]});
    update();
    return () => observer.disconnect();
  }, []);
  return {ref,preparing};
}
