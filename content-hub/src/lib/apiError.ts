import Anthropic from "@anthropic-ai/sdk";

/** The API's own explanation, without the status code and raw JSON around it. */
export function apiDetail(err: InstanceType<typeof Anthropic.APIError>) {
  return (err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
}
