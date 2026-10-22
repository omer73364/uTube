// Request playback streams rather than the limited URLs returned by metadata-only
// iOS player requests. Keep this at the transport boundary: the SDK does not expose
// player params through getBasicInfo's options.
export function playbackFetch(transport: typeof fetch): typeof fetch {
  return ((input, init) => {
    if (typeof init?.body !== "string") return transport(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      url.protocol !== "https:" ||
      !["www.youtube.com", "youtube.com", "youtubei.googleapis.com"].includes(
        url.hostname,
      ) ||
      !/^\/youtubei\/v\d+\/player$/.test(url.pathname) ||
      (
        init.method || (input instanceof Request ? input.method : "GET")
      ).toUpperCase() !== "POST"
    )
      return transport(input, init);
    let body;
    try {
      body = JSON.parse(init.body);
    } catch {
      return transport(input, init);
    }
    if (String(body?.context?.client?.clientName).toUpperCase() === "IOS")
      return transport(input, {
        ...init,
        body: JSON.stringify({ ...body, params: "2AMB" }),
      });
    return transport(input, init);
  }) as typeof fetch;
}
