"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { EditList } from "@/components/studio/EditList";
import { Editor } from "@/components/studio/Editor";
import { loadLibrary } from "@/lib/footage/library";
import { IN_CLAUDE } from "@/lib/platform";
import { studioUrl } from "@/lib/studio/actions";

export default function StudioPage() {
  if (IN_CLAUDE) {
    return (
      <PageHeader
        title="Studio"
        description="Studio edits video from the team's footage library, so it runs in the hosted hub, not this claude.ai copy."
      />
    );
  }
  return <Studio />;
}

const editFromUrl = () => new URLSearchParams(window.location.search).get("e");

function Studio() {
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    void loadLibrary();
    // The URL says which edit is open, so a link to an edit opens it and Back
    // returns to the list.
    const sync = () => setEditId(editFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const open = (id: string | null) => {
    window.history.pushState(null, "", studioUrl(id ?? undefined));
    setEditId(id);
  };

  return editId ? <Editor key={editId} id={editId} onClose={() => open(null)} /> : <EditList onOpen={open} />;
}
