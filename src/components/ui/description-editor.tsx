import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
} from "lucide-react";
import { cleanDescription } from "../../lib/description";
import { Dialog } from "./dialog";
import { Button } from "./button";
export function DescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useRef<HTMLDivElement>(null),
    selection = useRef<Range | null>(null),
    [link, setLink] = useState(false),
    [url, setUrl] = useState("");
  useEffect(() => {
    if (editor.current && document.activeElement !== editor.current)
      editor.current.innerHTML = cleanDescription(value);
  }, [value]);
  const command = (name: string, arg?: string) => {
    editor.current?.focus();
    document.execCommand(name, false, arg);
    onChange(cleanDescription(editor.current?.innerHTML ?? ""));
  };
  return (
    <div className="description-editor">
      <div
        className="description-toolbar"
        role="toolbar"
        aria-label="Description formatting"
      >
        {[
          [Bold, "bold"],
          [Italic, "italic"],
          [Underline, "underline"],
          [List, "insertUnorderedList"],
          [ListOrdered, "insertOrderedList"],
        ].map(([Icon, name]) => {
          const Control = Icon as typeof Bold;
          return (
            <button
              type="button"
              key={String(name)}
              aria-label={String(name)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command(String(name))}
            >
              <Control size={16} />
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Add description link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            selection.current = window.getSelection()?.rangeCount
              ? window.getSelection()!.getRangeAt(0).cloneRange()
              : null;
            setLink(true);
          }}
        >
          <LinkIcon size={16} />
        </button>
      </div>
      <div
        ref={editor}
        className="description-content"
        contentEditable
        role="textbox"
        aria-label="Product description"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={() =>
          onChange(cleanDescription(editor.current?.innerHTML ?? ""))
        }
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          onChange(cleanDescription(editor.current?.innerHTML ?? ""));
        }}
      />
      <Dialog open={link} onOpenChange={setLink} title="Add link">
        <label className="form-field">
          Web address
          <input
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="dialog-actions">
          <Button onClick={() => setLink(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!/^https?:\/\//i.test(url)}
            onClick={() => {
              editor.current?.focus();
              if (selection.current) {
                const current = window.getSelection();
                current?.removeAllRanges();
                current?.addRange(selection.current);
              }
              command("createLink", url);
              setLink(false);
              setUrl("");
            }}
          >
            Add Link
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
