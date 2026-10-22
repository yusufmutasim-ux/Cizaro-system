import Anthropic from "@anthropic-ai/sdk";
import { route, json } from "@/lib/api";
import { getConfig } from "@/lib/settings";
import { client, mcpServers, MODEL } from "@/lib/designer";

export const maxDuration = 120;

// Checks the Claude key and, when set, that the Higgsfield MCP server connects and lists its tools.
export const POST = route(async () => {
  const cfg = await getConfig();
  const servers = mcpServers(cfg);
  try {
    const res = await client(cfg).beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["mcp-client-2025-11-20"],
      output_config: { effort: "low" },
      ...(servers.length ? { mcp_servers: servers, tools: servers.map((s) => ({ type: "mcp_toolset" as const, mcp_server_name: s.name })) } : {}),
      messages: [{ role: "user", content: servers.length ? "Without calling any tool, list the names of the image/video generation tools you have access to, comma-separated. Nothing else." : "Reply with the single word: ok" }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join(" ").trim();
    return json({ claude: true, mcp: servers.length ? true : null, tools: servers.length ? text : "" });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ claude: false, error: "Invalid Claude API key" });
    if (e instanceof Anthropic.APIError) return json({ claude: !servers.length ? false : null, mcp: servers.length ? false : null, error: e.message });
    return json({ claude: false, error: (e as Error).message });
  }
});
