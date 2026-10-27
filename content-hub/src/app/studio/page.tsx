"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { EditList } from "@/components/studio/EditList";
import { Editor } from "@/components/studio/Editor";
import { Repurpose } from "@/components/studio/Repurpose";
import { loadLibrary } from "@/lib/footage/library";
import { IN_CLAUDE } from "@/lib/platform";
import { repurposeUrl, studioUrl } from "@/lib/studio/actions";

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

type View = { edit: string | null; long: string | null };

const viewFromUrl = (): View => {
  const q = new URLSearchParams(window.location.search);
  return { edit: q.get("e"), long: q.get("long") };
};

function Studio() {
  const [view, setView] = useState<View>({ edit: null, long: null });

  useEffect(() => {
    void loadLibrary();
    // The URL says what's open (an edit, or a long video being cut into
    // shorts), so a link opens it and Back returns to where you were.
    const sync = () => setView(viewFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const open = (id: string | null) => {
    window.history.pushState(null, "", studioUrl(id ?? undefined));
    setView({ edit: id, long: null });
  };
  const openLong = (footageId: string) => {
    window.history.pushState(null, "", repurposeUrl(footageId));
    setView({ edit: null, long: footageId });
  };

  if (view.edit) return <Editor key={view.edit} id={view.edit} onClose={() => open(null)} />;
  if (view.long) return <Repurpose key={view.long} footageId={view.long} onClose={() => open(null)} onOpenEdit={open} />;
  return <EditList onOpen={open} onOpenLong={openLong} />;
}
