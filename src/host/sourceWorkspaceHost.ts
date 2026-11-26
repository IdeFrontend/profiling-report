import type {
  PickSourceWorkspace,
  SourceWorkspaceFile,
} from '../adapters';

/**
 * Host picker for a source workspace (directory). One hidden directory input
 * per call; only files whose basename the library requested are read.
 * Focus can return before `change`; wait this long so a completed pick still wins.
 */
export const SOURCE_WORKSPACE_FOCUS_CANCEL_MS = 300;

/**
 * Host picker for a source workspace (directory). One hidden directory input
 * per call; only files whose basename the library requested are read.
 */
export const pickSourceWorkspace: PickSourceWorkspace = (request) =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';

    let settled = false;
    let changed = false;
    let focusTimer = 0;
    const finish = (files: SourceWorkspaceFile[] | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(focusTimer);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(files ? { files } : null);
    };

    async function readPicked(files: FileList | null): Promise<void> {
      const wanted = new Set(request.map((entry) => entry.basename.toLowerCase()));
      const picked = [...(files ?? [])].filter((file) => wanted.has(file.name.toLowerCase()));
      try {
        const read = await Promise.all(
          picked.map(async (file) => ({
            path: file.webkitRelativePath || file.name,
            text: await file.text(),
          })),
        );
        finish(read);
      } catch {
        finish(null);
      }
    }

    function onChange(event: Event): void {
      changed = true;
      const files = (event.target as HTMLInputElement).files;
      void readPicked(files);
    }

    function onCancel(): void {
      finish(null);
    }

    /**
     * The dialog closed without change / cancel (browser-specific). Focus
     * returns to the page, so settle as a cancel instead of hanging forever.
     * A change may already be reading its files when focus fires: keep that pick.
     */
    function onWindowFocus(): void {
      if (changed || settled) return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!changed) finish(null);
      }, SOURCE_WORKSPACE_FOCUS_CANCEL_MS);
    }

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
