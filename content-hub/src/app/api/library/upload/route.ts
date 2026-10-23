import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { STORAGE } from "@/lib/footage/store";
import { isFootageFile } from "@/lib/footage/types";

// Raw footage goes from the browser straight into the private Blob store; this
// route only signs the upload. (A function's 4.5 MB body limit would rule out
// sending video through here.) The sign-in in proxy.ts guards it.
export async function POST(req: Request) {
  if (STORAGE !== "blob") return Response.json({ error: "Blob storage isn't connected here." }, { status: 400 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!isFootageFile(pathname)) throw new Error("Uploads go under footage/files/.");
        return {
          allowedContentTypes: ["video/*"],
          maximumSizeInBytes: 50 * 1024 ** 3,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
